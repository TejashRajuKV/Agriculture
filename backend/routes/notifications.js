import express from 'express';
import { asyncHandler } from '../utils/httpError.js';
import { requireAuth } from '../middleware/auth.js';
import * as v from '../utils/validate.js';
import * as notifications from '../services/notificationService.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => res.json(await notifications.getUserNotifications(req.user._id, { limit: Number(req.query.limit) || 30 }))));
router.patch('/read-all', asyncHandler(async (req, res) => res.json(await notifications.markAllAsRead(req.user._id))));
router.patch('/:id/read', asyncHandler(async (req, res) => res.json(await notifications.markAsRead(req.user._id, v.objectId(req.params.id, 'notification id')))));

export default router;
