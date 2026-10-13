import Notification from '../../models/Notification.js';

// Every adapter implements: async send({ user, title, message, type, referenceType, referenceId })
// Add a real SMS/email provider by writing another adapter with the same shape and
// registering it in notificationService.js - no other code changes needed.

export class InAppNotificationAdapter {
  name = 'in-app';

  async send(n) {
    return Notification.create({
      user: n.userId,
      title: n.title,
      message: n.message,
      type: n.type,
      referenceType: n.referenceType,
      referenceId: n.referenceId ? String(n.referenceId) : undefined
    });
  }
}

// Development stand-in for an SMS gateway: logs what would be sent, needs no API key.
export class MockSmsAdapter {
  name = 'sms-mock';

  constructor({ log = console.log } = {}) {
    this.log = log;
  }

  async send(n) {
    if (!n.phone) return null;
    this.log(`[sms-mock] to ${n.phone}: ${n.title} - ${n.message}`);
    return { delivered: false, mocked: true };
  }
}
