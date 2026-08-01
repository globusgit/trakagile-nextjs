import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    _id: mongoose.Types.ObjectId,
    empObjId: {
      type: mongoose.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    empId: {
      type: String,
      require: true,
    },
    date: { type: Date, required: true }, // YYYY-MM-DD (store as Date, but query by date)
    checkIn: { type: Number },
    checkOut: { type: Number },
    totalWorkedMinutes: { type: Number },
    status: {
      type: String,
      enum: [
        "Present",
        "Absent",
        "Half_day",
        "Late",
        "On_leave",
        "Holiday",
        "Weekend",
      ],
      default: "Absent",
    },
    lateByMinutes: { type: Number },
    notes: { type: String },
    //source: { type: String, enum: ["web", "mobile", "manual"], default: "web" },
    orgId: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

// Compound index to ensure one attendance per user per day
attendanceSchema.index({ orgId: 1, date: 1 });
attendanceSchema.index({ employeeId: 1, date: 1 });
attendanceSchema.index({ orgId: 1, employeeId: 1, date: 1 });

export default mongoose.models.Attendance ||
  mongoose.model("Attendance", attendanceSchema);
