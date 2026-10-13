import User, { Roles } from '../models/User.js';
import { verifyToken } from '../services/authService.js';
import { forbidden, unauthorized } from '../utils/httpError.js';

// Loads the user from the database on every request, so the role used for
// authorisation always comes from the server, never from the browser.
export const requireAuth = async (req, res, next) => {
  try {
    const header = req.get('Authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const userId = verifyToken(token);
    if (!userId) throw unauthorized();
    const user = await User.findById(userId);
    if (!user) throw unauthorized('Your account no longer exists');
    if (user.disabled) throw forbidden('This account has been suspended. Please contact AgriLoop support.');
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== Roles.ADMIN && !roles.includes(req.user.role)) return next(forbidden());
  next();
};

// Managers may only act on the centres they are assigned to (admins on all)
export const canManageCenter = (user, centerId) =>
  user.role === Roles.ADMIN ||
  (user.role === Roles.PROCUREMENT_MANAGER && (user.centerIds || []).some((id) => String(id) === String(centerId)));
