import Listing from '../models/Listing.js';
import User, { Roles } from '../models/User.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/httpError.js';
import * as v from '../utils/validate.js';
import { saveDataUrlImage } from '../utils/imageStore.js';
import { geocodePlace } from '../utils/geo.js';
import { notify } from './notificationService.js';

// Household waste pickup -> biogas plant collection.
//   OPEN  (ACTIVE)   household has submitted a pickup request
//   CLAIMED (RESERVED) a biogas plant has committed to collect it
//   COLLECTED (SOLD_OUT) the plant confirmed collection
// Households earn carbon points for degradable waste that is actually collected.
export const POINTS_PER_KG_DEGRADABLE = 2;

const view = (l, user) => ({
  id: String(l._id),
  degradability: l.degradability,
  quantityKg: l.quantityListed,
  address: l.location?.label || '',
  image: l.image || null,
  description: l.description || '',
  submittedBy: String(l.seller) === String(user._id) ? 'you' : l.sellerName,
  isOwn: String(l.seller) === String(user._id),
  stage: { ACTIVE: 'OPEN', RESERVED: 'CLAIMED', SOLD_OUT: 'COLLECTED', CANCELLED: 'CANCELLED' }[l.status] || l.status,
  collectedByName: l.collectedByName || null,
  claimedByMe: l.collectedBy ? String(l.collectedBy) === String(user._id) : false,
  claimedAt: l.claimedAt || null,
  completedAt: l.completedAt || null,
  createdAt: l.createdAt,
  pointsEarned: l.status === 'SOLD_OUT' && l.degradability === 'DEGRADABLE' ? Math.round(l.quantityListed * POINTS_PER_KG_DEGRADABLE) : 0
});

export const createRequest = async (user, body = {}) => {
  if (user.role !== Roles.HOUSEHOLD) throw forbidden('Only households can submit waste for collection');
  const degradability = v.oneOf(body.degradability, 'Waste type', ['DEGRADABLE', 'NON_DEGRADABLE']);
  const quantityKg = v.positiveNumber(body.quantityKg, 'Weight (kg)', { max: 1000 });
  const address = v.requiredString(body.address, 'Pickup address', { min: 5, max: 200 });
  const description = v.optionalString(body.description, 'Description', { max: 300 });
  const coords = await geocodePlace(address);

  const l = await Listing.create({
    kind: 'HOUSEHOLD',
    seller: user._id,
    sellerType: 'HOUSEHOLD',
    sellerName: user.name,
    title: degradability === 'DEGRADABLE' ? 'Degradable household waste' : 'Non-degradable household waste',
    description,
    image: await saveDataUrlImage(body.image),
    quantityAvailable: quantityKg,
    quantityListed: quantityKg,
    unit: 'kg',
    degradability,
    location: { label: address, ...(coords || {}) },
    status: 'ACTIVE'
  });
  return view(l, user);
};

// Households see their own requests; biogas plants see open requests plus the ones they claimed
export const listRequests = async (user, { degradability } = {}) => {
  let filter;
  if (user.role === Roles.HOUSEHOLD) filter = { kind: 'HOUSEHOLD', seller: user._id };
  else if (user.role === Roles.BIOGAS || user.role === Roles.ADMIN) filter = { kind: 'HOUSEHOLD', $or: [{ status: 'ACTIVE' }, { collectedBy: user._id }] };
  else throw forbidden();
  if (degradability) filter.degradability = v.oneOf(degradability, 'Waste type', ['DEGRADABLE', 'NON_DEGRADABLE']);
  const rows = await Listing.find(filter).sort({ createdAt: -1 }).limit(100);
  return rows.map((l) => view(l, user));
};

const loadHousehold = async (id) => {
  const l = await Listing.findById(v.objectId(id, 'request id'));
  if (!l || l.kind !== 'HOUSEHOLD') throw notFound('Request not found');
  return l;
};

export const cancelRequest = async (user, id) => {
  const l = await loadHousehold(id);
  if (String(l.seller) !== String(user._id)) throw forbidden('You can only cancel your own requests');
  const done = await Listing.findOneAndUpdate({ _id: l._id, status: 'ACTIVE' }, { $set: { status: 'CANCELLED' } }, { new: true });
  if (!done) throw conflict('A plant has already taken this pickup, so it cannot be cancelled now');
  return view(done, user);
};

export const claimRequest = async (user, id) => {
  if (user.role !== Roles.BIOGAS) throw forbidden('Only biogas plants can claim pickups');
  const l = await loadHousehold(id);
  if (l.degradability !== 'DEGRADABLE') throw badRequest('Biogas plants can only collect degradable waste');
  // Only one plant can win: the update succeeds only while the request is still open
  const done = await Listing.findOneAndUpdate(
    { _id: l._id, status: 'ACTIVE' },
    { $set: { status: 'RESERVED', collectedBy: user._id, collectedByName: user.name, claimedAt: new Date() } },
    { new: true }
  );
  if (!done) throw conflict('Another plant has just taken this pickup');
  notify({
    userId: l.seller,
    type: 'SYSTEM',
    title: 'A biogas plant will collect your waste',
    message: `${user.name} has accepted your ${l.quantityListed} kg pickup at ${l.location?.label}.`,
    referenceType: 'waste',
    referenceId: l._id
  });
  return view(done, user);
};

export const confirmCollected = async (user, id) => {
  const l = await loadHousehold(id);
  if (!l.collectedBy || String(l.collectedBy) !== String(user._id)) throw forbidden('Only the plant that claimed this pickup can confirm collection');
  const done = await Listing.findOneAndUpdate(
    { _id: l._id, status: 'RESERVED' },
    { $set: { status: 'SOLD_OUT', quantityAvailable: 0, completedAt: new Date() } },
    { new: true }
  );
  if (!done) throw conflict('This pickup is not waiting for collection');
  const points = done.degradability === 'DEGRADABLE' ? Math.round(done.quantityListed * POINTS_PER_KG_DEGRADABLE) : 0;
  if (points) await User.updateOne({ _id: l.seller }, { $inc: { carbonPoints: points } });
  notify({
    userId: l.seller,
    type: 'SYSTEM',
    title: `Waste collected${points ? ` · +${points} carbon points` : ''}`,
    message: `${user.name} collected your ${l.quantityListed} kg of ${l.degradability === 'DEGRADABLE' ? 'degradable' : ''} waste.`,
    referenceType: 'waste',
    referenceId: l._id
  });
  return view(done, user);
};
