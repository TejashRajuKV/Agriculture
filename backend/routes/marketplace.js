import express from 'express';
import { asyncHandler } from '../utils/httpError.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Roles } from '../models/User.js';
import * as market from '../services/marketplaceService.js';

const router = express.Router();
router.use(requireAuth);
const sellers = requireRole(Roles.FARMER, Roles.FPO);

router.get('/listings', asyncHandler(async (req, res) => res.json(await market.listListings(req.user, req.query))));
router.get('/listings/:id', asyncHandler(async (req, res) => res.json(await market.getListing(req.user, req.params.id))));
router.post(
  '/listings',
  sellers,
  asyncHandler(async (req, res) => {
    const create = req.body?.kind === 'RESIDUE' ? market.createResidueListing : market.createProduceListing;
    res.status(201).json(await create(req.user, req.body));
  })
);
router.patch('/listings/:id', sellers, asyncHandler(async (req, res) => res.json(await market.updateListing(req.user, req.params.id, req.body))));
router.delete('/listings/:id', sellers, asyncHandler(async (req, res) => res.json(await market.deleteListing(req.user, req.params.id))));

// Crop residue bidding
router.post('/listings/:id/bids', requireRole(Roles.BUYER), asyncHandler(async (req, res) => res.status(201).json(await market.placeBid(req.user, req.params.id, req.body))));
router.delete('/listings/:id/bids/mine', requireRole(Roles.BUYER), asyncHandler(async (req, res) => res.json(await market.withdrawBid(req.user, req.params.id))));
router.post('/listings/:id/bids/:bidId/accept', sellers, asyncHandler(async (req, res) => res.json(await market.acceptBid(req.user, req.params.id, req.params.bidId))));
router.post('/listings/:id/bids/:bidId/reject', sellers, asyncHandler(async (req, res) => res.json(await market.rejectBid(req.user, req.params.id, req.params.bidId))));
router.post('/listings/:id/complete', asyncHandler(async (req, res) => res.json(await market.completeResidueSale(req.user, req.params.id))));

export const cropsRouter = express.Router();
cropsRouter.get('/', asyncHandler(async (req, res) => res.json(await market.listCrops())));

export default router;
