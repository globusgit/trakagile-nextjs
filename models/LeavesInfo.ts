import mongoose from "mongoose";

const leavesInfoSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Types.ObjectId, ref: "User", required: true },
    year: { type: Number, required: true }, // e.g., 2026
    casual: { type: Number, default: 0 },
    sick: { type: Number, default: 0 },
    earned: { type: Number, default: 0 },
    unpaid: { type: Number, default: 0 },
    maternity: { type: Number, default: 0 },
    paternity: { type: Number, default: 0 },
    usedCasual: { type: Number, default: 0 },
    usedSick: { type: Number, default: 0 },
    usedEarned: { type: Number, default: 0 },
    usedMaternity: { type: Number, default: 0 },
    usedPaternity: { type: Number, default: 0 },
    orgId: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

// Compound index for unique user-year
leavesInfoSchema.index({ orgId: 1, userId: 1, year: 1 }, { unique: true });

export default mongoose.models.LeavesInfo ||
  mongoose.model("LeavesInfo", leavesInfoSchema);
