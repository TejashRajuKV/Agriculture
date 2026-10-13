import express from 'express';
import { asyncHandler } from '../utils/httpError.js';
import { requireAuth } from '../middleware/auth.js';
import * as mandi from '../services/mandiService.js';

const router = express.Router();
router.use(requireAuth);

router.get('/status', (req, res) => res.json(mandi.status()));
router.get('/prices', asyncHandler(async (req, res) => res.json(await mandi.getMandiPrices(req.query))));

export default router;
