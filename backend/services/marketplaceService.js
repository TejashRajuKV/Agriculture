import Listing from '../models/Listing.js';
import Crop from '../models/Crop.js';
import Order from '../models/Order.js';
import User, { Roles } from '../models/User.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/httpError.js';
import * as v from '../utils/validate.js';
import { todayIST, addDays, daysBetween } from '../utils/dates.js';
import { saveDataUrlImage } from '../utils/imageStore.js';
import { geocodePlace } from '../utils/geo.js';
import { notify } from './notificationService.js';

const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const round2 = (n) => Math.round(n * 100) / 100;
// 1 carbon point per 10 kg CO2 kept out of the air (same rule as before)
const carbonPointsFor = (listing) => Math.round(((listing.analysis?.co2Saved || 0) * listing.quantityListed) / 10);

const isOwner = (listing, user) => String(listing.seller?._id || listing.seller) === String(user._id);

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------
export const listingView = (l, user) => {
  const own = user && isOwner(l, user);
  const bids = (l.bids || []).map((b) => ({
    id: String(b._id),
    buyerId: String(b.buyer),
    buyerName: b.buyerName,
    pricePerTon: b.pricePerTon,
    pickupDate: b.pickupDate,
    message: b.message,
    status: b.status,
    createdAt: b.createdAt,
    total: Math.round(b.pricePerTon * l.quantityListed)
  }));
  const active = bids.filter((b) => b.status !== 'REJECTED');
  const accepted = bids.find((b) => l.acceptedBid && b.id === String(l.acceptedBid)) || null;
  const mine = user ? bids.find((b) => b.buyerId === String(user._id)) || null : null;

  return {
    id: String(l._id),
    kind: l.kind,
    title: l.title,
    description: l.description || '',
    image: l.image || null,
    crop: l.crop ? { id: String(l.crop._id || l.crop), name: l.crop.name } : null,
    seller: { id: String(l.seller?._id || l.seller), name: l.sellerName, type: l.sellerType },
    isOwn: Boolean(own),
    quantityAvailable: l.quantityAvailable,
    quantityListed: l.quantityListed,
    unit: l.unit,
    pricePerUnit: l.pricePerUnit ?? null,
    minOrderQuantity: l.minOrderQuantity,
    harvestDate: l.harvestDate || null,
    qualityGrade: l.qualityGrade,
    location: l.location?.label || '',
    status: l.status,
    createdAt: l.createdAt,
    // RESIDUE
    analysis: l.analysis || null,
    bidCount: active.length,
    highestBid: active.reduce((m, b) => Math.max(m, b.pricePerTon), 0) || null,
    // Sellers see every bid; buyers only their own
    bids: own ? bids : undefined,
    myBid: mine,
    acceptedBid: own || (mine && accepted && accepted.id === mine.id) ? accepted : accepted ? { buyerName: accepted.buyerName, pricePerTon: accepted.pricePerTon } : null,
    carbonPoints: l.kind === 'RESIDUE' ? carbonPointsFor(l) : undefined
  };
};

// ---------------------------------------------------------------------------
// Browse
// ---------------------------------------------------------------------------
const SORTS = {
  newest: { createdAt: -1 },
  price_asc: { pricePerUnit: 1, createdAt: -1 },
  price_desc: { pricePerUnit: -1, createdAt: -1 },
  harvest: { harvestDate: -1, createdAt: -1 },
  quantity: { quantityAvailable: -1 }
};

export const listListings = async (user, q = {}) => {
  const kind = q.kind ? v.oneOf(q.kind, 'kind', ['PRODUCE', 'RESIDUE']) : 'PRODUCE';
  const filter = { kind };

  if (q.mine === '1' || q.mine === 'true') {
    filter.seller = user._id;
    filter.status = { $ne: 'CANCELLED' };
  } else if (q.mybids === '1' || q.mybids === 'true') {
    filter['bids.buyer'] = user._id;
  } else {
    // Residue buyers also see reserved/sold lots (so they can follow their deals)
    filter.status = kind === 'RESIDUE' ? { $in: ['ACTIVE', 'RESERVED', 'SOLD_OUT'] } : 'ACTIVE';
  }

  if (q.search) {
    const s = String(q.search).trim().slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(s, 'i');
    const cropIds = await Crop.find({ name: rx }).distinct('_id');
    filter.$or = [{ title: rx }, { sellerName: rx }, { 'location.label': rx }, { crop: { $in: cropIds } }];
  }
  if (q.cropId) filter.crop = v.objectId(q.cropId, 'crop id');
  if (q.location) filter['location.label'] = new RegExp(String(q.location).slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (q.quality) filter.qualityGrade = v.oneOf(q.quality, 'quality', ['A', 'B', 'C', 'UNGRADED']);
  if (q.sellerType) filter.sellerType = v.oneOf(q.sellerType, 'seller type', ['FARMER', 'FPO']);
  if (q.minPrice || q.maxPrice) {
    filter.pricePerUnit = {};
    if (q.minPrice) filter.pricePerUnit.$gte = v.number(q.minPrice, 'minimum price', { min: 0 });
    if (q.maxPrice) filter.pricePerUnit.$lte = v.number(q.maxPrice, 'maximum price', { min: 0 });
  }
  if (q.minQuantity) filter.quantityAvailable = { $gte: v.number(q.minQuantity, 'minimum quantity', { min: 0 }) };
  if (q.harvestFrom) filter.harvestDate = { $gte: v.isoDate(q.harvestFrom, 'harvest date') };

  const sort = SORTS[q.sort] || SORTS.newest;
  const listings = await Listing.find(filter).sort(sort).limit(100).populate('crop', 'name');
  return listings.map((l) => listingView(l, user));
};

export const getListing = async (user, id) => {
  const l = await Listing.findById(v.objectId(id, 'listing id')).populate('crop', 'name');
  if (!l) throw notFound('Listing not found');
  const seller = await User.findById(l.seller).select('name phone location role buyerType');
  return {
    ...listingView(l, user),
    sellerContact: seller ? { name: seller.name, phone: seller.phone || null, location: seller.location?.label || '' } : null
  };
};

// ---------------------------------------------------------------------------
// Produce listings
// ---------------------------------------------------------------------------
const cleanHarvestDate = (value) => {
  const date = v.isoDate(value, 'Harvest date');
  const diff = daysBetween(todayIST(), date);
  if (diff > 90) throw badRequest('Harvest date can be at most 90 days ahead');
  if (diff < -365) throw badRequest('Harvest date is more than a year ago');
  return date;
};

const sellerFields = (user) => {
  if (![Roles.FARMER, Roles.FPO].includes(user.role)) throw forbidden('Only farmers and FPOs can list produce');
  return { seller: user._id, sellerType: user.role === Roles.FPO ? 'FPO' : 'FARMER', sellerName: user.name, fpo: user.fpo };
};

const locationFor = async (user, label) => {
  const clean = v.optionalString(label, 'Location', { max: 120 }) || user.location?.label || '';
  if (clean && clean === user.location?.label && user.location?.lat != null) {
    return { label: clean, lat: user.location.lat, lng: user.location.lng };
  }
  const coords = clean ? await geocodePlace(clean) : null;
  return { label: clean, ...(coords || {}) };
};

export const createProduceListing = async (user, body = {}) => {
  const seller = sellerFields(user);
  const crop = await Crop.findById(v.objectId(body.cropId, 'crop id'));
  if (!crop) throw notFound('Crop not found');
  const quantity = v.positiveNumber(body.quantity, 'Quantity', { max: 10000000 });
  const unit = v.oneOf(body.unit || 'kg', 'Unit', ['kg', 'quintal', 'ton']);
  const pricePerUnit = v.number(body.pricePerUnit, 'Price per unit', { min: 0, max: 10000000 });
  const minOrderQuantity = body.minOrderQuantity === undefined || body.minOrderQuantity === '' ? 1 : v.positiveNumber(body.minOrderQuantity, 'Minimum order quantity');
  if (minOrderQuantity > quantity) throw badRequest('Minimum order quantity cannot be more than the quantity available');

  const listing = await Listing.create({
    kind: 'PRODUCE',
    ...seller,
    crop: crop._id,
    title: v.optionalString(body.title, 'Title', { max: 100 }) || crop.name,
    description: v.optionalString(body.description, 'Description', { max: 1000 }),
    image: await saveDataUrlImage(body.image),
    quantityAvailable: quantity,
    quantityListed: quantity,
    unit,
    pricePerUnit: round2(pricePerUnit),
    minOrderQuantity,
    harvestDate: body.harvestDate ? cleanHarvestDate(body.harvestDate) : todayIST(),
    qualityGrade: v.oneOf(body.qualityGrade || 'UNGRADED', 'Quality grade', ['A', 'B', 'C', 'UNGRADED']),
    location: await locationFor(user, body.location),
    status: body.status === 'DRAFT' ? 'DRAFT' : 'ACTIVE'
  });
  await listing.populate('crop', 'name');
  return listingView(listing, user);
};

export const updateListing = async (user, id, body = {}) => {
  const listing = await Listing.findById(v.objectId(id, 'listing id'));
  if (!listing) throw notFound('Listing not found');
  if (!isOwner(listing, user) && user.role !== Roles.ADMIN) throw forbidden('You can only edit your own listings');
  if (listing.kind !== 'PRODUCE') throw badRequest('Residue listings are managed through bids');
  if (['CANCELLED', 'EXPIRED'].includes(listing.status)) throw conflict('This listing is closed');

  const set = {};
  if (body.title !== undefined) set.title = v.requiredString(body.title, 'Title', { max: 100 });
  if (body.description !== undefined) set.description = v.optionalString(body.description, 'Description', { max: 1000 });
  if (body.pricePerUnit !== undefined) set.pricePerUnit = round2(v.number(body.pricePerUnit, 'Price per unit', { min: 0, max: 10000000 }));
  if (body.qualityGrade !== undefined) set.qualityGrade = v.oneOf(body.qualityGrade, 'Quality grade', ['A', 'B', 'C', 'UNGRADED']);
  if (body.harvestDate !== undefined) set.harvestDate = cleanHarvestDate(body.harvestDate);
  if (body.image !== undefined) set.image = await saveDataUrlImage(body.image);
  if (body.status !== undefined) set.status = v.oneOf(body.status, 'Status', ['ACTIVE', 'DRAFT']);

  const minOrder = body.minOrderQuantity !== undefined ? v.positiveNumber(body.minOrderQuantity, 'Minimum order quantity') : listing.minOrderQuantity;
  set.minOrderQuantity = minOrder;

  // Quantity changes use the value we read as a precondition, so a sale that
  // happens at the same moment is never overwritten.
  const filter = { _id: listing._id };
  const inc = {};
  if (body.quantityAvailable !== undefined) {
    const next = v.number(body.quantityAvailable, 'Quantity available', { min: 0, max: 10000000 });
    filter.quantityAvailable = listing.quantityAvailable;
    inc.quantityAvailable = next - listing.quantityAvailable;
    if (next > listing.quantityListed) inc.quantityListed = next - listing.quantityListed;
    if (next === 0) set.status = 'SOLD_OUT';
    else if (listing.status === 'SOLD_OUT' && !set.status) set.status = 'ACTIVE';
    if (minOrder > next && next > 0) throw badRequest('Minimum order quantity cannot be more than the quantity available');
  } else if (minOrder > listing.quantityAvailable && listing.quantityAvailable > 0) {
    throw badRequest('Minimum order quantity cannot be more than the quantity available');
  }
  if (set.status === 'ACTIVE' && (body.quantityAvailable ?? listing.quantityAvailable) === 0) set.status = 'SOLD_OUT';

  const updated = await Listing.findOneAndUpdate(filter, { $set: set, ...(Object.keys(inc).length ? { $inc: inc } : {}) }, { new: true }).populate('crop', 'name');
  if (!updated) throw conflict('Stock changed while you were editing (an order came in). Reload and try again.');
  return listingView(updated, user);
};

// Soft delete: keeps order history intact
export const deleteListing = async (user, id) => {
  const listing = await Listing.findById(v.objectId(id, 'listing id'));
  if (!listing) throw notFound('Listing not found');
  if (!isOwner(listing, user) && user.role !== Roles.ADMIN) throw forbidden('You can only remove your own listings');
  const updated = await Listing.findOneAndUpdate(
    { _id: listing._id, status: { $in: ['DRAFT', 'ACTIVE', 'SOLD_OUT'] } },
    { $set: { status: 'CANCELLED' } },
    { new: true }
  );
  if (!updated) throw conflict('This listing cannot be removed now (a sale is in progress)');
  const openOrders = await Order.countDocuments({ listing: listing._id, status: { $in: ['PENDING', 'CONFIRMED', 'PROCESSING', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT'] } });
  return { id: String(updated._id), status: updated.status, openOrders };
};

// ---------------------------------------------------------------------------
// Residue listings (bidding)
// ---------------------------------------------------------------------------
const cleanAnalysis = (a = {}) => {
  const num = (x, max) => (Number.isFinite(Number(x)) ? Math.min(max, Math.max(0, Number(x))) : undefined);
  const str = (x, max = 80) => (typeof x === 'string' ? x.slice(0, max) : undefined);
  return {
    residueType: str(a.residueType) || 'Crop residue',
    residueKey: str(a.residueKey, 40),
    suggestedUses: Array.isArray(a.suggestedUses) ? a.suggestedUses.slice(0, 5).map((u) => str(u, 60)).filter(Boolean) : [],
    transportFeasibility: ['High', 'Medium', 'Low'].includes(a.transportFeasibility) ? a.transportFeasibility : 'Medium',
    environmentalImpactScore: num(a.environmentalImpactScore, 10),
    pricePerTonMin: num(a.pricePerTonMin, 100000),
    pricePerTonMax: num(a.pricePerTonMax, 100000),
    estimatedPriceRange: str(a.estimatedPriceRange),
    moistureContent: str(a.moistureContent),
    confidence: num(a.confidence, 1),
    co2Saved: num(a.co2Saved, 5000),
    correctedByFarmer: Boolean(a.correctedByFarmer),
    source: str(a.source, 20)
  };
};

export const createResidueListing = async (user, body = {}) => {
  const seller = sellerFields(user);
  const analysis = cleanAnalysis(body.analysis);
  const quantity = v.positiveNumber(body.quantity, 'Quantity (tonnes)', { max: 10000 });
  const listing = await Listing.create({
    kind: 'RESIDUE',
    ...seller,
    title: analysis.residueType,
    image: await saveDataUrlImage(body.image),
    quantityAvailable: quantity,
    quantityListed: quantity,
    unit: 'ton',
    minOrderQuantity: quantity,
    location: await locationFor(user, body.location),
    analysis,
    status: 'ACTIVE'
  });
  return listingView(listing, user);
};

const residueFor = async (id) => {
  const listing = await Listing.findById(v.objectId(id, 'listing id'));
  if (!listing) throw notFound('Listing not found');
  if (listing.kind !== 'RESIDUE') throw badRequest('Bids are only for crop residue listings');
  return listing;
};

export const placeBid = async (user, id, body = {}) => {
  if (user.role !== Roles.BUYER) throw forbidden('Only buyers can place bids');
  const listing = await residueFor(id);
  if (isOwner(listing, user)) throw forbidden('You cannot bid on your own listing');
  if (listing.status !== 'ACTIVE') throw conflict('This lot is no longer open for bids');

  const pricePerTon = Math.round(v.positiveNumber(body.pricePerTon, 'Price per tonne', { max: 100000 }));
  const pickupDate = v.isoDate(body.pickupDate, 'Pickup date');
  if (pickupDate < todayIST()) throw badRequest('Pickup date cannot be in the past');
  if (pickupDate > addDays(todayIST(), 60)) throw badRequest('Pickup date must be within 60 days');
  const message = v.optionalString(body.message, 'Message', { max: 200 });

  // Update my existing bid, or add one - each buyer has at most one bid per lot
  const updated = await Listing.updateOne(
    { _id: listing._id, status: 'ACTIVE', 'bids.buyer': user._id },
    { $set: { 'bids.$.pricePerTon': pricePerTon, 'bids.$.pickupDate': pickupDate, 'bids.$.message': message, 'bids.$.status': 'PENDING', 'bids.$.updatedAt': new Date() } }
  );
  if (!updated.matchedCount) {
    const added = await Listing.updateOne(
      { _id: listing._id, status: 'ACTIVE', 'bids.buyer': { $ne: user._id } },
      { $push: { bids: { buyer: user._id, buyerName: user.name, pricePerTon, pickupDate, message } } }
    );
    if (!added.matchedCount) throw conflict('This lot is no longer open for bids');
  }

  notify({
    userId: listing.seller,
    type: 'BID_UPDATE',
    title: `New bid on your ${listing.title}`,
    message: `${user.name} offered ${inr(pricePerTon)}/t (${inr(pricePerTon * listing.quantityListed)} total), pickup ${pickupDate}.`,
    referenceType: 'listing',
    referenceId: listing._id
  });
  return getListing(user, id);
};

export const withdrawBid = async (user, id) => {
  const listing = await residueFor(id);
  const res = await Listing.updateOne(
    { _id: listing._id, status: 'ACTIVE' },
    { $pull: { bids: { buyer: user._id, status: { $in: ['PENDING', 'REJECTED'] } } } }
  );
  if (!res.modifiedCount) throw conflict('You have no open bid on this lot');
  return getListing(user, id);
};

export const rejectBid = async (user, id, bidId) => {
  const listing = await residueFor(id);
  if (!isOwner(listing, user)) throw forbidden('Only the seller can decline bids');
  const bid = listing.bids.id(v.objectId(bidId, 'bid id'));
  if (!bid) throw notFound('Bid not found');
  const res = await Listing.updateOne(
    { _id: listing._id, status: 'ACTIVE', bids: { $elemMatch: { _id: bid._id, status: 'PENDING' } } },
    { $set: { 'bids.$.status': 'REJECTED' } }
  );
  if (!res.modifiedCount) throw conflict('This bid can no longer be declined');
  notify({
    userId: bid.buyer,
    type: 'BID_UPDATE',
    title: `Bid declined · ${listing.title}`,
    message: `${listing.sellerName} declined your bid of ${inr(bid.pricePerTon)}/t. You can bid again while the lot is open.`,
    referenceType: 'listing',
    referenceId: listing._id
  });
  return getListing(user, id);
};

export const acceptBid = async (user, id, bidId) => {
  const listing = await residueFor(id);
  if (!isOwner(listing, user)) throw forbidden('Only the seller can accept bids');
  const bid = listing.bids.id(v.objectId(bidId, 'bid id'));
  if (!bid) throw notFound('Bid not found');

  const updated = await Listing.findOneAndUpdate(
    { _id: listing._id, status: 'ACTIVE', bids: { $elemMatch: { _id: bid._id, status: 'PENDING' } } },
    { $set: { status: 'RESERVED', acceptedBid: bid._id, 'bids.$[win].status': 'ACCEPTED', 'bids.$[other].status': 'REJECTED' } },
    { new: true, arrayFilters: [{ 'win._id': bid._id }, { 'other._id': { $ne: bid._id }, 'other.status': 'PENDING' }] }
  );
  if (!updated) throw conflict('This bid can no longer be accepted');

  const total = bid.pricePerTon * listing.quantityListed;
  notify({
    userId: bid.buyer,
    type: 'BID_UPDATE',
    title: `Bid accepted · ${listing.title}`,
    message: `Collect on ${bid.pickupDate} and pay ${inr(total)} on pickup.`,
    referenceType: 'listing',
    referenceId: listing._id
  });
  for (const other of listing.bids.filter((b) => String(b._id) !== String(bid._id) && b.status === 'PENDING')) {
    notify({
      userId: other.buyer,
      type: 'BID_UPDATE',
      title: `Lot sold to another buyer · ${listing.title}`,
      message: `${listing.sellerName} accepted a different bid.`,
      referenceType: 'listing',
      referenceId: listing._id
    });
  }
  return getListing(user, id);
};

// Pickup done: buyer pays the seller, seller earns carbon points
export const completeResidueSale = async (user, id) => {
  const listing = await residueFor(id);
  const bid = listing.acceptedBid && listing.bids.id(listing.acceptedBid);
  if (listing.status !== 'RESERVED' || !bid) throw conflict('Accept a bid before completing the sale');
  const isBuyer = String(bid.buyer) === String(user._id);
  if (!isOwner(listing, user) && !isBuyer && user.role !== Roles.ADMIN) throw forbidden('Only the seller or the buyer can complete this sale');

  const total = Math.round(bid.pricePerTon * listing.quantityListed);
  const debited = await User.updateOne({ _id: bid.buyer, walletBalance: { $gte: total } }, { $inc: { walletBalance: -total } });
  if (!debited.modifiedCount) throw conflict(`The buyer's wallet does not have ${inr(total)}`);

  const done = await Listing.findOneAndUpdate(
    { _id: listing._id, status: 'RESERVED' },
    { $set: { status: 'SOLD_OUT', quantityAvailable: 0, completedAt: new Date() } },
    { new: true }
  );
  if (!done) {
    await User.updateOne({ _id: bid.buyer }, { $inc: { walletBalance: total } }); // refund
    throw conflict('This sale was already completed');
  }
  const points = carbonPointsFor(listing);
  await User.updateOne({ _id: listing.seller }, { $inc: { walletBalance: total, carbonPoints: points } });

  notify({
    userId: listing.seller,
    type: 'BID_UPDATE',
    title: `Sale complete · ${inr(total)} received`,
    message: `${bid.buyerName} collected your ${listing.title}. +${points.toLocaleString('en-IN')} carbon points.`,
    referenceType: 'listing',
    referenceId: listing._id
  });
  notify({
    userId: bid.buyer,
    type: 'BID_UPDATE',
    title: `Purchase complete · ${listing.title}`,
    message: `${inr(total)} paid to ${listing.sellerName}.`,
    referenceType: 'listing',
    referenceId: listing._id
  });
  return getListing(user, id);
};

export const listCrops = async () => {
  const crops = await Crop.find().sort({ name: 1 }).lean();
  return crops.map((c) => ({ id: String(c._id), name: c.name, category: c.category, unit: c.unit, agmarknetName: c.agmarknetName || null }));
};
