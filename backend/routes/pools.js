import express from 'express';
import { asyncHandler } from '../utils/httpError.js';
import { requireAuth } from '../middleware/auth.js';
import * as pools from '../services/poolService.js';

// Village straw pools: role checks live in the service
const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => res.json(await pools.listPools(req.user, req.query))));
router.post('/', asyncHandler(async (req, res) => res.status(201).json(await pools.createPool(req.user, req.body))));
router.get('/:id', asyncHandler(async (req, res) => res.json(await pools.getPool(req.user, req.params.id))));
router.post('/:id/join', asyncHandler(async (req, res) => res.json(await pools.joinPool(req.user, req.params.id, req.body))));
router.post('/:id/leave', asyncHandler(async (req, res) => res.json(await pools.leavePool(req.user, req.params.id))));
router.post('/:id/bids', asyncHandler(async (req, res) => res.status(201).json(await pools.placeBid(req.user, req.params.id, req.body))));
router.delete('/:id/bids/mine', asyncHandler(async (req, res) => res.json(await pools.withdrawBid(req.user, req.params.id))));
router.post('/:id/bids/:bidId/accept', asyncHandler(async (req, res) => res.json(await pools.acceptBid(req.user, req.params.id, req.params.bidId))));
router.post('/:id/complete', asyncHandler(async (req, res) => res.json(await pools.completePool(req.user, req.params.id))));
router.post('/:id/cancel', asyncHandler(async (req, res) => res.json(await pools.cancelPool(req.user, req.params.id))));

export default router;
