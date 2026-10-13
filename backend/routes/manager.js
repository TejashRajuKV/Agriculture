import express from 'express';
import { asyncHandler } from '../utils/httpError.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Roles } from '../models/User.js';
import * as manager from '../services/managerService.js';

// Every action also checks that the manager is assigned to the booking's centre
const router = express.Router();
router.use(requireAuth, requireRole(Roles.PROCUREMENT_MANAGER));

router.get('/centers', asyncHandler(async (req, res) => res.json(await manager.listManagedCenters(req.user))));
router.get('/overview', asyncHandler(async (req, res) => res.json(await manager.overview(req.user, req.query))));
router.get('/queue', asyncHandler(async (req, res) => res.json((await manager.overview(req.user, req.query)).queue)));
router.post('/queue/call-next', asyncHandler(async (req, res) => res.json(await manager.callNext(req.user, req.body))));
router.post('/queue/:bookingId/check-in', asyncHandler(async (req, res) => res.json(await manager.checkInFarmer(req.user, req.params.bookingId))));
router.post('/queue/:bookingId/call', asyncHandler(async (req, res) => res.json(await manager.callBooking(req.user, req.params.bookingId))));
router.post('/queue/:bookingId/skip', asyncHandler(async (req, res) => res.json(await manager.skipBooking(req.user, req.params.bookingId))));
router.post('/procurement/:bookingId/start', asyncHandler(async (req, res) => res.json(await manager.startProcurement(req.user, req.params.bookingId))));
router.post('/procurement/:bookingId/weight', asyncHandler(async (req, res) => res.json(await manager.recordWeight(req.user, req.params.bookingId, req.body))));
router.post('/procurement/:bookingId/quality', asyncHandler(async (req, res) => res.json(await manager.recordQuality(req.user, req.params.bookingId, req.body))));
router.post('/procurement/:bookingId/complete', asyncHandler(async (req, res) => res.json(await manager.completeProcurement(req.user, req.params.bookingId))));
router.post('/assisted-booking', asyncHandler(async (req, res) => res.status(201).json(await manager.assistedBooking(req.user, req.body))));
router.post('/payment/:paymentId/delay', asyncHandler(async (req, res) => res.json(await manager.noteDelay(req.user, req.params.paymentId, req.body))));
router.post('/centers/:centerId/prices', asyncHandler(async (req, res) => res.json(await manager.setCropPrice(req.user, req.params.centerId, req.body))));
router.post('/payment/:paymentId/update', asyncHandler(async (req, res) => res.json(await manager.updatePayment(req.user, req.params.paymentId, req.body))));

export default router;
