// Fixed reasons a payment can be late or fail, with what the farmer should do about it.
// Kept in one place so the manager's choices, the farmer's screen and the notifications agree.
export const DELAY_REASONS = {
  BANK_DETAILS_MISMATCH: {
    label: 'Bank details do not match',
    farmerAction: 'The name or account number did not match your records. Check your bank passbook and give the centre the correct details.'
  },
  ACCOUNT_NOT_LINKED: {
    label: 'Bank account not linked for direct payment',
    farmerAction: 'Your account must be linked for direct benefit payments. Visit your bank with your Aadhaar and passbook to link it.'
  },
  FUNDS_PENDING: {
    label: 'Waiting for funds to be released',
    farmerAction: 'The centre is waiting for funds to be released. Nothing is needed from you. Ask the centre for the expected date.'
  },
  RECORD_VERIFICATION: {
    label: 'Land or farmer record being verified',
    farmerAction: 'Your registration or land record is being checked. Carry your land record and ID to the centre to speed this up.'
  },
  BANK_TECHNICAL: {
    label: 'Bank or system problem',
    farmerAction: 'A bank or system problem delayed the transfer. The centre will retry. Nothing is needed from you yet.'
  },
  OTHER: {
    label: 'Other reason',
    farmerAction: 'Please check with the centre for details.'
  }
};

export const DELAY_CODES = Object.keys(DELAY_REASONS);

export const delayView = (payment) =>
  payment?.delayCode && DELAY_REASONS[payment.delayCode]
    ? {
        code: payment.delayCode,
        label: DELAY_REASONS[payment.delayCode].label,
        farmerAction: DELAY_REASONS[payment.delayCode].farmerAction,
        note: payment.delayNote || null,
        since: payment.delayAt || null
      }
    : null;
