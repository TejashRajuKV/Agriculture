import express from 'express';
import { asyncHandler } from '../utils/httpError.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Roles } from '../models/User.js';
import { getGlutAlerts } from '../services/glutService.js';

const router = express.Router();
router.use(requireAuth, requireRole(Roles.FARMER, Roles.FPO, Roles.PROCUREMENT_MANAGER));

router.get('/glut', asyncHandler(async (req, res) => res.json(await getGlutAlerts(req.user))));

export default router;
