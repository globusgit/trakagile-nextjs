import mongoose from "mongoose";

const DefaultListSchema = new mongoose.Schema(
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
  },
  { timestamps: true },
);

export default mongoose.models.DefaultList ||
  mongoose.model("DefaultList", DefaultListSchema);
