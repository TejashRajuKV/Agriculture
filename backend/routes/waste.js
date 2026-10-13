import express from 'express';
import { asyncHandler } from '../utils/httpError.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Roles } from '../models/User.js';
import * as waste from '../services/wasteService.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => res.json(await waste.listRequests(req.user, req.query))));
router.post('/', requireRole(Roles.HOUSEHOLD), asyncHandler(async (req, res) => res.status(201).json(await waste.createRequest(req.user, req.body))));
router.post('/:id/cancel', requireRole(Roles.HOUSEHOLD), asyncHandler(async (req, res) => res.json(await waste.cancelRequest(req.user, req.params.id))));
router.post('/:id/claim', requireRole(Roles.BIOGAS), asyncHandler(async (req, res) => res.json(await waste.claimRequest(req.user, req.params.id))));
router.post('/:id/collected', requireRole(Roles.BIOGAS), asyncHandler(async (req, res) => res.json(await waste.confirmCollected(req.user, req.params.id))));

export default router;
