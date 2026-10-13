import express from 'express';
import User from '../models/User.js';
import ProcurementCenter from '../models/ProcurementCenter.js';
import ProcurementRecord from '../models/ProcurementRecord.js';
import Listing from '../models/Listing.js';
import { asyncHandler } from '../utils/httpError.js';

// Real, aggregate-only numbers for the landing page (no personal data)
const router = express.Router();

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const [farmers, centers, listings, procured] = await Promise.all([
      User.countDocuments({ role: { $in: ['FARMER', 'FPO'] } }),
      ProcurementCenter.countDocuments({ status: 'ACTIVE' }),
      Listing.countDocuments({ kind: { $in: ['PRODUCE', 'RESIDUE'] }, status: 'ACTIVE' }),
      ProcurementRecord.aggregate([{ $match: { status: 'COMPLETED' } }, { $group: { _id: null, kg: { $sum: '$acceptedQuantity' }, lots: { $sum: 1 } } }])
    ]);
    res.set('Cache-Control', 'public, max-age=60');
    res.json({
      farmers,
      procurementCenters: centers,
      activeListings: listings,
      lotsProcured: procured[0]?.lots || 0,
      tonnesProcured: Math.round(((procured[0]?.kg || 0) / 1000) * 10) / 10
    });
  })
);

export default router;
