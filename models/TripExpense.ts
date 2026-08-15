import mongoose from "mongoose";

const TripExpenseSchema = new mongoose.Schema({
  tripId: { type: mongoose.Types.ObjectId, ref: "FieldTrip", required: true, index: true },
  orgId: { type: String, required: true, index: true },
  employeeId: { type: String, required: true },
  category: { type: String, enum: ["HOTEL", "FOOD", "FUEL", "TOLL", "PARKING", "TICKET", "TAXI_AUTO", "CLIENT", "OTHER"], required: true },
  amount: { type: Number, required: true, min: 0.01 },
  vendor: { type: String, trim: true },
  paymentMethod: { type: String, trim: true },
  remarks: { type: String, trim: true },
  receiptPath: String,
  receiptName: String,
  receiptHash: String,
  status: { type: String, enum: ["SUBMITTED", "APPROVED", "REJECTED"], default: "SUBMITTED" },
}, { timestamps: true });
TripExpenseSchema.index({ tripId: 1, createdAt: -1 });
TripExpenseSchema.index({ tripId: 1, receiptHash: 1 }, { unique: true, sparse: true });
export default mongoose.models.TripExpense || mongoose.model("TripExpense", TripExpenseSchema);
