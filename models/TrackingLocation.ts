// models/TrackingLocation.js
import mongoose from "mongoose";

// 1. Define a simple coordinate schema
const CoordinateSchema = new mongoose.Schema(
  {
    lat: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    lng: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
  },
  { _id: false },
); // Prevents generating an _id for every single coordinate

// 2. Define your main model
const TrackingLocationSchema = new mongoose.Schema(
  {
    trackingDate: {
      type: Date,
      required: true,
    },
    startLocation: {
      type: CoordinateSchema,
      required: true,
    },
    lastKnownLocation: {
      type: CoordinateSchema,
      required: true,
    },
    endLocation: {
      type: CoordinateSchema,
      required: true,
    },
    // Store the list of coordinates
    coordinates: [CoordinateSchema],
    orgId: {
      type: String,
      required: true,
    },
    empId: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

// 3. Next.js Catch: Prevent "OverwriteModelError" during hot-reloading
const TrackingLocation =
  mongoose.models.TrackingLocation ||
  mongoose.model("TrackingLocation", TrackingLocationSchema);

export default TrackingLocation;
