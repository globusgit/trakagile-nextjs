import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      require: true,
      trim: true,
    },
    password: {
      type: String,
      require: true,
    },
    employeeName: {
      type: String,
      require: true,
    },
    status: {
      type: String,
      require: true,
      default: "Active",
    },
    role: {
      type: String,
    },
    isFirstLogin: {
      type: Boolean,
      default: true,
    },
    orgId: {
      type: String,
    },
  },
  { timestamps: true },
);

UserSchema.index({ orgId: 1, username: 1 }, { unique: true });

export default mongoose.models.User || mongoose.model("User", UserSchema);
