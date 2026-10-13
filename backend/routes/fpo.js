import express from 'express';
import { asyncHandler } from '../utils/httpError.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Roles } from '../models/User.js';
import * as fpo from '../services/fpoService.js';

const router = express.Router();
router.use(requireAuth, requireRole(Roles.FPO));

router.get('/overview', asyncHandler(async (req, res) => res.json(await fpo.overview(req.user))));
router.post('/members', asyncHandler(async (req, res) => res.status(201).json(await fpo.addMember(req.user, req.body))));
router.delete('/members/:farmerId', asyncHandler(async (req, res) => res.json(await fpo.removeMember(req.user, req.params.farmerId))));

export default router;
