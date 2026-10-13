import express from 'express';
import { asyncHandler } from '../utils/httpError.js';
import { requireAuth } from '../middleware/auth.js';
import * as schemes from '../services/schemeService.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => res.json(await schemes.listSchemes(req.user))));
router.post('/reminders', asyncHandler(async (req, res) => res.status(201).json(await schemes.addReminder(req.user, req.body))));
router.delete('/reminders/:id', asyncHandler(async (req, res) => res.json(await schemes.deleteReminder(req.user, req.params.id))));

export default router;
