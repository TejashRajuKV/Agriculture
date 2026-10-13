import express from 'express';
import { asyncHandler } from '../utils/httpError.js';
import { requireAuth } from '../middleware/auth.js';
import * as m from '../services/machineService.js';

// Role checks live in the service
const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => res.json(await m.listMachines(req.user, req.query))));
router.post('/', asyncHandler(async (req, res) => res.status(201).json(await m.createMachine(req.user, req.body))));
router.get('/bookings', asyncHandler(async (req, res) => res.json(await m.listBookings(req.user, req.query))));
router.post('/bookings/:id/accept', asyncHandler(async (req, res) => res.json(await m.acceptBooking(req.user, req.params.id))));
router.post('/bookings/:id/decline', asyncHandler(async (req, res) => res.json(await m.declineBooking(req.user, req.params.id))));
router.post('/bookings/:id/cancel', asyncHandler(async (req, res) => res.json(await m.cancelBooking(req.user, req.params.id))));
router.post('/bookings/:id/complete', asyncHandler(async (req, res) => res.json(await m.completeBooking(req.user, req.params.id))));
router.patch('/:id', asyncHandler(async (req, res) => res.json(await m.updateMachine(req.user, req.params.id, req.body))));
router.get('/:id/availability', asyncHandler(async (req, res) => res.json(await m.availability(req.user, req.params.id))));
router.post('/:id/book', asyncHandler(async (req, res) => res.status(201).json(await m.requestBooking(req.user, req.params.id, req.body))));

export default router;
