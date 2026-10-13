import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { notFound } from '../utils/httpError.js';
import { InAppNotificationAdapter, MockSmsAdapter } from './notifications/adapters.js';

// In-app is the source of truth; other channels are best-effort extras.
const adapters = [new InAppNotificationAdapter()];
if (process.env.NOTIFY_SMS_MOCK !== '0' && process.env.NODE_ENV !== 'test') adapters.push(new MockSmsAdapter());

export const createNotification = async ({ userId, title, message, type = 'SYSTEM', referenceType, referenceId }) => {
  const user = await User.findById(userId).select('phone');
  if (!user) return null;
  const payload = { userId, phone: user.phone, title, message, type, referenceType, referenceId };
  const [inApp, ...others] = adapters;
  const saved = await inApp.send(payload);
  // Extra channels must never break the main action (booking, payment, order...)
  await Promise.allSettled(others.map((a) => a.send(payload)));
  return saved;
};

// Fire-and-forget helper for use inside business flows
export const notify = (n) =>
  createNotification(n).catch((err) => console.error('Notification failed:', err.message));

export const getUserNotifications = async (userId, { limit = 30 } = {}) => {
  const [items, unread] = await Promise.all([
    Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(Math.min(limit, 100)).lean(),
    Notification.countDocuments({ user: userId, isRead: false })
  ]);
  return {
    unread,
    items: items.map((n) => ({
      id: String(n._id),
      title: n.title,
      message: n.message,
      type: n.type,
      referenceType: n.referenceType || null,
      referenceId: n.referenceId || null,
      isRead: n.isRead,
      createdAt: n.createdAt
    }))
  };
};

export const markAsRead = async (userId, notificationId) => {
  const n = await Notification.findOneAndUpdate({ _id: notificationId, user: userId }, { isRead: true }, { new: true });
  if (!n) throw notFound('Notification not found');
  return { id: String(n._id), isRead: true };
};

export const markAllAsRead = async (userId) => {
  const res = await Notification.updateMany({ user: userId, isRead: false }, { isRead: true });
  return { updated: res.modifiedCount };
};
