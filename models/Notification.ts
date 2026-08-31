import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    orgId: { type: String, required: true, index: true },
    recipientEmpId: { type: String, required: true, index: true },
    employeeEmpId: { type: String, required: true },
    attendanceId: { type: mongoose.Types.ObjectId, ref: "Attendance" },
    type: {
      type: String,
      enum: ["TRAVEL_STARTED", "LOCATION_STALE", "POSSIBLE_DELAY", "SITE_REACHED", "VISIT_COMPLETED", "ATTENDANCE_COMPLETED", "HOTEL_CHECK_IN", "HOTEL_CHECK_OUT", "TRIP_COMPLETED", "EXPENSE_SUBMITTED", "WFH_REQUEST", "WFH_REVIEWED", "DEVICE_CHANGE_REQUEST", "DEVICE_CHANGE_REVIEWED", "LEAVE_REQUEST", "LEAVE_REVIEWED", "LEAVE_CANCELLATION", "TASK_ASSIGNED", "TASK_STATUS_UPDATED"],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    dedupeKey: { type: String, required: true },
    readAt: Date,
  },
  { timestamps: true },
);

NotificationSchema.index({ orgId: 1, recipientEmpId: 1, createdAt: -1 });
NotificationSchema.index({ orgId: 1, recipientEmpId: 1, dedupeKey: 1 }, { unique: true });

export default mongoose.models.Notification ||
  mongoose.model("Notification", NotificationSchema);