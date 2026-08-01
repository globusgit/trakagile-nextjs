import mongoose from "mongoose";

const leaveRequestSchema = new mongoose.Schema(
  {
    _id: mongoose.Types.ObjectId,
    userId: { type: mongoose.Types.ObjectId, ref: "User", required: true },
    leaveType: {
      type: String,
      enum: [
        "casual",
        "sick",
        "earned",
        "unpaid",
        "maternity",
        "paternity",
        "other",
      ],
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number, required: true }, // Total days (including half-days)
    reason: { type: String },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
    },
    approvedBy: { type: mongoose.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    rejectionReason: { type: String },
    orgId: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

export default mongoose.models.LeaveRequest ||
  mongoose.model("LeaveRequest", leaveRequestSchema);
