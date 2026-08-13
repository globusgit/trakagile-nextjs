import mongoose from "mongoose";

const leaveRequestSchema = new mongoose.Schema(
  {
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
    days: { type: Number, required: true },
    reason: { type: String },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancellation_pending", "cancelled"],
      default: "pending",
    },
    approvedBy: { type: mongoose.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    rejectionReason: { type: String },
    cancellationReason: { type: String }, // why the employee wants to cancel
    cancellationRequestedAt: { type: Date },
    cancellationDecisionReason: { type: String }, // admin's note when rejecting a cancellation request
    orgId: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

export default mongoose.models.LeaveRequest ||
  mongoose.model("LeaveRequest", leaveRequestSchema);