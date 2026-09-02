import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    employeeName: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      default: "Active",
    },
    role: {
      type: String,
    },
    isFirstLogin: {
      type: Boolean,
      default: true,
    },
    failedLoginAttempts: { type: Number, default: 0, min: 0, select: false },
    lockedUntil: { type: Date, select: false },
    passwordChangedAt: { type: Date },
    tokenVersion: { type: Number, default: 0, min: 0, select: false },
    orgId: {
      type: String,
    },
  },
  { timestamps: true },
);

UserSchema.index({ orgId: 1, username: 1 }, { unique: true });

export default mongoose.models.User || mongoose.model("User", UserSchema);
