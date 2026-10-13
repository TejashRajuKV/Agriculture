import express from 'express';
import { asyncHandler } from '../utils/httpError.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Roles } from '../models/User.js';
import * as admin from '../services/adminService.js';

// Strictly admin only (requireRole lets admins through; nobody else matches)
const router = express.Router();
router.use(requireAuth, requireRole(Roles.ADMIN));

router.get('/overview', asyncHandler(async (req, res) => res.json({ ...(await admin.overview()), fleet: await admin.fleetSummary() })));
router.get('/attention', asyncHandler(async (req, res) => res.json(await admin.attention())));
router.get('/centres', asyncHandler(async (req, res) => res.json(await admin.centres())));
router.get('/fpos', asyncHandler(async (req, res) => res.json(await admin.fpos())));
router.get('/users', asyncHandler(async (req, res) => res.json(await admin.listUsers(req.query))));
router.post('/users/:id/suspend', asyncHandler(async (req, res) => res.json(await admin.setSuspended(req.user, req.params.id, req.body))));
router.put('/users/:id/centres', asyncHandler(async (req, res) => res.json(await admin.assignCentres(req.user, req.params.id, req.body))));
router.post('/staff', asyncHandler(async (req, res) => res.status(201).json(await admin.createStaff(req.user, req.body))));
router.get('/audit', asyncHandler(async (req, res) => res.json(await admin.auditLog(req.query))));

export default router;
