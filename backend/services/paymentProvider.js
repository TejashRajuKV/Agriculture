import crypto from 'crypto';

// Payment provider interface:
//   initiate(payment)          -> { status: 'PROCESSING', transactionRef }
//   settle(payment, outcome)   -> { status: 'PAID' | 'FAILED', transactionRef, paidAt?, failureReason? }
// SimulatedPaymentProvider moves money only in the database; swap in a real
// gateway (e.g. a bank/UPI API) by implementing the same two methods.

export class SimulatedPaymentProvider {
  name = 'SIMULATED';

  async initiate(payment) {
    return { status: 'PROCESSING', transactionRef: `SIM-${payment.id.slice(-6).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}` };
  }

  async settle(payment, { outcome, reason }) {
    if (outcome === 'PAID') return { status: 'PAID', transactionRef: payment.transactionRef, paidAt: new Date() };
    return { status: 'FAILED', transactionRef: payment.transactionRef, failureReason: reason || 'Marked as failed by the centre' };
  }
}

export const paymentProvider = new SimulatedPaymentProvider();
