import express from 'express';
import { asyncHandler } from '../utils/httpError.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Roles } from '../models/User.js';
import * as orders from '../services/orderService.js';
import { trackOrder } from '../services/logisticsService.js';

const router = express.Router();
router.use(requireAuth);

router.post('/', requireRole(Roles.BUYER), asyncHandler(async (req, res) => res.status(201).json(await orders.createOrder(req.user, req.body))));
router.get('/', asyncHandler(async (req, res) => res.json(await orders.listOrders(req.user, { as: req.query.as }))));
router.get('/:id/tracking', asyncHandler(async (req, res) => res.json(await trackOrder(req.user, req.params.id))));
router.get('/:id', asyncHandler(async (req, res) => res.json(await orders.getOrder(req.user, req.params.id))));
router.patch('/:id/status', asyncHandler(async (req, res) => res.json(await orders.updateOrderStatus(req.user, req.params.id, req.body))));

export default router;
