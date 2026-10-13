import express from 'express';
import { asyncHandler } from '../utils/httpError.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Roles } from '../models/User.js';
import * as logistics from '../services/logisticsService.js';

const router = express.Router();
router.use(requireAuth, requireRole(Roles.LOGISTICS_OPERATOR));

router.get('/vehicles', asyncHandler(async (req, res) => res.json(await logistics.listVehicles(req.user))));
router.post('/vehicles', asyncHandler(async (req, res) => res.status(201).json(await logistics.createVehicle(req.user, req.body))));
router.patch('/vehicles/:id', asyncHandler(async (req, res) => res.json(await logistics.setVehicleStatus(req.user, req.params.id, req.body))));
router.get('/orders', asyncHandler(async (req, res) => res.json(await logistics.listReadyOrders())));
router.post('/plan', asyncHandler(async (req, res) => res.json(await logistics.previewTrip(req.user, req.body))));
router.get('/deliveries', asyncHandler(async (req, res) => res.json(await logistics.listTrips(req.user, req.query))));
router.post('/deliveries', asyncHandler(async (req, res) => res.status(201).json(await logistics.createTrip(req.user, req.body))));
router.get('/deliveries/:id', asyncHandler(async (req, res) => res.json(await logistics.getTrip(req.user, req.params.id))));
router.post('/deliveries/:id/start', asyncHandler(async (req, res) => res.json(await logistics.startTrip(req.user, req.params.id))));
router.post('/deliveries/:id/stops/:sequence/complete', asyncHandler(async (req, res) => res.json(await logistics.completeStop(req.user, req.params.id, req.params.sequence))));
router.post('/deliveries/:id/cancel', asyncHandler(async (req, res) => res.json(await logistics.cancelTrip(req.user, req.params.id))));

export default router;
