import mongoose from "mongoose";

// Mongoose Schema
const EmployeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    empId: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String },
    photo: { type: String },
    photoFileId: { type: mongoose.Types.ObjectId },
    designation: { type: String },
    status: {
      type: String,
      default: "Active",
    },
    isManager: { type: Boolean, default: false },
    reportingManager: {
      type: String,
    },
    reportingTo: { type: mongoose.Types.ObjectId, ref: "Employee" }, // Manager's ID
    orgId: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

EmployeeSchema.index({ orgId: 1, email: 1 }, { unique: true });
EmployeeSchema.index({ orgId: 1, empId: 1 }, { unique: true });

export default mongoose.models.Employee ||
  mongoose.model("Employee", EmployeeSchema);
