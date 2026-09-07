import mongoose from "mongoose";

const PlatformAdminSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    password: { type: String, required: true, select: false },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, default: null, select: false },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

PlatformAdminSchema.index({ username: 1 }, { unique: true });

export default mongoose.models.PlatformAdmin || mongoose.model("PlatformAdmin", PlatformAdminSchema);
