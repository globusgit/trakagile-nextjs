import mongoose from "mongoose";

const ActivityLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  details: { type: String },
  timestamp: { type: Date, default: Date.now },
  //EMPLOYEE/LEAVE_REQUEST/NOTE/ORGANIZATION
  entityType: { type: String, required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  orgId: { type: String, required: true },
});

ActivityLogSchema.index({ entityType: 1, entityId: 1, orgId: 1 });

export default mongoose.models.ActivityLog ||
  mongoose.model("ActivityLog", ActivityLogSchema);
