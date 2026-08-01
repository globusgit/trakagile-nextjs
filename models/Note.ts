import mongoose from "mongoose";

const NoteSchema = new mongoose.Schema(
  {
    note: { type: String, required: true },
    addedBy: { type: String, required: true },
    addedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orgId: { type: String, required: true },
    //EMPLOYEE/LEAVE_REQUEST/NOTE/ORGANIZATION
    entityType: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { timestamps: true },
);

NoteSchema.index({ entityType: 1, entityId: 1, orgId: 1 });

export default mongoose.models.Note || mongoose.model("Note", NoteSchema);
