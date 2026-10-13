import mongoose from 'mongoose';

// Kilograms a centre took in per crop per day. This is the training data for the demand forecast.
// `simulated: true` rows are placeholder history created by the seed so the model has something to
// learn from on a new install; real procurement replaces them day by day (see recordRealIntake).
const intakeSchema = new mongoose.Schema(
  {
    center: { type: mongoose.Schema.Types.ObjectId, ref: 'ProcurementCenter', required: true },
    crop: { type: mongoose.Schema.Types.ObjectId, ref: 'Crop', required: true },
    date: { type: String, required: true }, // 'YYYY-MM-DD'
    kg: { type: Number, required: true, min: 0 },
    simulated: { type: Boolean, default: false }
  },
  { timestamps: true }
);
intakeSchema.index({ center: 1, crop: 1, date: 1 }, { unique: true });

export default mongoose.model('IntakeHistory', intakeSchema);

// Called when a lot is completed. The first real lot of a day replaces the simulated figure for that
// day; later lots the same day add to it.
export const recordRealIntake = async (center, crop, date, kg) => {
  if (!(kg > 0)) return;
  const Model = mongoose.model('IntakeHistory');
  const replaced = await Model.updateOne({ center, crop, date, simulated: true }, { $set: { kg, simulated: false } });
  if (replaced.modifiedCount) return;
  await Model.updateOne({ center, crop, date }, { $inc: { kg } }, { upsert: true });
};
