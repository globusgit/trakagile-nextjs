import mongoose from "mongoose";

const holidaySchema = new mongoose.Schema(
  {
    //_id: mongoose.Types.ObjectId,
    name: { type: String, required: true }, // e.g., "New Year's Day"
    date: { type: Date, required: true }, // YYYY-MM-DD
    isRecurring: { type: Boolean, default: false }, // Annual holiday
    isOptional: { type: Boolean, default: false }, // Optional/restricted holiday 
    year: { type: Number }, // Optional, for non-recurring holidays
    note: { type: String }, // Optional note about the holiday
    orgId: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

// Index for fast date queries
holidaySchema.index({ date: 1 });

export default mongoose.models.Holiday ||
  mongoose.model("Holiday", holidaySchema);
