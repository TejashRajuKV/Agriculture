import express from 'express';
import { asyncHandler } from '../utils/httpError.js';
import { requireAuth } from '../middleware/auth.js';
import { getDashboard } from '../services/dashboardService.js';

const router = express.Router();
router.get('/', requireAuth, asyncHandler(async (req, res) => res.json(await getDashboard(req.user))));

export default router;
