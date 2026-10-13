import mongoose from 'mongoose';

export const NotificationTypes = [
  'SLOT_REMINDER',
  'BOOKING',
  'QUEUE_UPDATE',
  'PROCUREMENT_UPDATE',
  'PAYMENT_UPDATE',
  'ORDER_UPDATE',
  'BID_UPDATE',
  'DELIVERY_UPDATE',
  'SYSTEM'
];

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: NotificationTypes, default: 'SYSTEM' },
    referenceType: String, // 'booking' | 'order' | 'listing' | 'payment'
    referenceId: String,
    isRead: { type: Boolean, default: false }
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
