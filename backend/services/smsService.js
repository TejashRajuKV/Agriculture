// Plain text SMS for things that are not in-app notifications (login codes).
// Only a mock exists: it logs instead of sending, so no provider key is needed. A real gateway
// (MSG91, Twilio, ...) plugs in by replacing `deliver` with the same signature.
const outbox = [];

const deliver = async (phone, text) => {
  if (process.env.NODE_ENV === 'test') {
    outbox.push({ phone, text });
    return { mocked: true };
  }
  console.log(`[sms-mock] to ${phone}: ${text}`);
  return { mocked: true };
};

export const sendSms = (phone, text) => deliver(phone, text);

// Test helper: the most recent message sent to a number
export const lastSmsTo = (phone) => [...outbox].reverse().find((m) => m.phone === phone) || null;
