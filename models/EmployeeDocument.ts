import mongoose from "mongoose";

const EmployeeDocumentSchema = new mongoose.Schema({
  orgId: { type: String, required: true, index: true },
  employeeId: { type: String, required: true, index: true },
  category: { type: String, enum: ["IDENTITY", "CERTIFICATE", "TRAVEL", "HOTEL", "CLIENT", "MEDICAL", "OTHER"], required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  gridFsFileId: { type: mongoose.Types.ObjectId },
  storedName: String,
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  fileHash: { type: String, required: true },
  uploadedBy: { type: mongoose.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

EmployeeDocumentSchema.index({ orgId: 1, employeeId: 1, createdAt: -1 });
EmployeeDocumentSchema.index({ orgId: 1, employeeId: 1, fileHash: 1 }, { unique: true });
export default mongoose.models.EmployeeDocument || mongoose.model("EmployeeDocument", EmployeeDocumentSchema);
