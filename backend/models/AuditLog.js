import mongoose from 'mongoose';

// Who changed what on the platform. Append-only: nothing in the app edits or deletes these rows.
const auditSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorName: String,
    action: { type: String, required: true }, // e.g. USER_SUSPENDED
    target: String, // human readable, e.g. the person's name and email
    details: mongoose.Schema.Types.Mixed
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
auditSchema.index({ createdAt: -1 });

export default mongoose.model('AuditLog', auditSchema);
