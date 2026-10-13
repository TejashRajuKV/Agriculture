import express from 'express';
import { asyncHandler } from '../utils/httpError.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Roles } from '../models/User.js';
import * as intel from '../services/intelligenceService.js';

const router = express.Router();
router.use(requireAuth);

router.get('/demand', requireRole(Roles.FARMER, Roles.FPO, Roles.PROCUREMENT_MANAGER), asyncHandler(async (req, res) => res.json(await intel.demandForecast(req.query))));
router.get('/model', requireRole(Roles.PROCUREMENT_MANAGER, Roles.FPO), (req, res) => res.json(intel.modelInfo()));
router.get('/price-guidance', requireRole(Roles.FARMER, Roles.FPO), asyncHandler(async (req, res) => res.json(await intel.priceGuidance(req.query))));

export default router;
