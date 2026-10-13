// Government schemes a farmer may care about. Facts here are general and slow-changing; anything with
// a date is marked "typical" because deadlines are set by each state every season. Always confirm
// with the official link or the local agriculture office. Add or edit entries here only.
export const SCHEMES = [
  {
    id: 'pm-kisan',
    name: 'PM-KISAN',
    summary: 'Income support of ₹6,000 a year paid in three instalments to eligible farmer families.',
    needs: ['Land record', 'Aadhaar linked to the bank account', 'eKYC completed'],
    link: 'https://pmkisan.gov.in',
    states: 'ALL',
    windows: [],
    tip: 'Instalments stop if eKYC or land seeding is pending. Check your status on the official site.'
  },
  {
    id: 'pmfby',
    name: 'PM Fasal Bima Yojana (crop insurance)',
    summary: 'Insurance against crop loss from drought, flood, pests and similar. Farmers pay a small share of the premium.',
    needs: ['Land record or tenancy proof', 'Bank account', 'Sowing details'],
    link: 'https://pmfby.gov.in',
    // Punjab has not joined the scheme; most other states have
    states: { exclude: ['Punjab'] },
    windows: [
      { label: 'Kharif enrolment (typical last date)', month: 7, day: 31 },
      { label: 'Rabi enrolment (typical last date)', month: 12, day: 31 }
    ],
    tip: 'Enrol before the cut-off your state announces; late enrolment is refused. Dates shown are typical, confirm each season.'
  },
  {
    id: 'kcc',
    name: 'Kisan Credit Card',
    summary: 'Short-term crop loans at a lower interest rate, through your bank.',
    needs: ['Land record', 'Identity and address proof', 'Bank account'],
    link: null,
    states: 'ALL',
    windows: [],
    tip: 'Ask your bank branch for current limits and interest terms. Prompt repayment usually earns an interest concession.'
  },
  {
    id: 'msp-procurement',
    name: 'MSP procurement at government centres',
    summary: 'Sell eligible crops to the government at the minimum support price through a procurement centre.',
    needs: ['Farmer registration with the state portal or centre', 'Land record', 'Bank account'],
    link: null,
    states: 'ALL',
    windows: [],
    tip: 'Register before the season starts. Produce above the moisture limit may be rejected, so check the centre page before you travel.'
  },
  {
    id: 'soil-health-card',
    name: 'Soil Health Card',
    summary: 'Free soil testing with advice on the right amount of fertiliser for your field.',
    needs: ['Your field details'],
    link: null,
    states: 'ALL',
    windows: [],
    tip: 'Get your soil tested before sowing so you do not over-buy fertiliser. Ask at your local agriculture office or KVK.'
  }
];

export const appliesIn = (scheme, state) => {
  if (scheme.states === 'ALL' || !state) return true;
  return !(scheme.states.exclude || []).some((s) => s.toLowerCase() === String(state).toLowerCase());
};
