import mongoose from "mongoose";

const SystemListSchema = new mongoose.Schema(
  {
    listName: {
      type: String,
      required: true,
    },
    listItem: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    orgId: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

export default mongoose.models.SystemList ||
  mongoose.model("SystemList", SystemListSchema);
