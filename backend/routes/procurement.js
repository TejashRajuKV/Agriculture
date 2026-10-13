import express from 'express';
import { asyncHandler } from '../utils/httpError.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Roles } from '../models/User.js';
import * as procurement from '../services/procurementService.js';

// Mounted twice: /api/procurement-centers (discovery) and /api/procurement (bookings)
export const centersRouter = express.Router();
centersRouter.use(requireAuth);
centersRouter.get('/', asyncHandler(async (req, res) => res.json(await procurement.listCenters(req.user, { search: req.query.search }))));
centersRouter.get('/:id', asyncHandler(async (req, res) => res.json(await procurement.getCenter(req.params.id, req.user))));
centersRouter.get('/:id/slots', asyncHandler(async (req, res) => res.json(await procurement.getSlots(req.params.id, req.query.date))));

export const bookingsRouter = express.Router();
bookingsRouter.use(requireAuth);
const farmerOnly = requireRole(Roles.FARMER, Roles.FPO);

bookingsRouter.post('/bookings', farmerOnly, asyncHandler(async (req, res) => res.status(201).json(await procurement.createBooking(req.user, req.body))));
bookingsRouter.get('/bookings', farmerOnly, asyncHandler(async (req, res) => res.json(await procurement.listMyBookings(req.user))));
// Detail endpoints check ownership / centre access inside the service
bookingsRouter.get('/payments', farmerOnly, asyncHandler(async (req, res) => res.json(await procurement.listMyPayments(req.user))));
bookingsRouter.get('/bookings/:id', asyncHandler(async (req, res) => res.json(await procurement.getBookingDetail(req.user, req.params.id))));
bookingsRouter.get('/bookings/:id/queue', asyncHandler(async (req, res) => res.json(await procurement.getBookingQueue(req.user, req.params.id))));
bookingsRouter.get('/bookings/:id/status', asyncHandler(async (req, res) => res.json(await procurement.getBookingStatus(req.user, req.params.id))));
bookingsRouter.post('/bookings/:id/check-in', farmerOnly, asyncHandler(async (req, res) => res.json(await procurement.checkIn(req.user, req.params.id))));
bookingsRouter.post('/bookings/:id/cancel', farmerOnly, asyncHandler(async (req, res) => res.json(await procurement.cancelBooking(req.user, req.params.id))));
