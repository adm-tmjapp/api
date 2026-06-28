import mongoose, { Document, Schema } from "mongoose";

export interface IRideLocationSnapshot extends Document {
  rideId: mongoose.Types.ObjectId;
  driverUserId: mongoose.Types.ObjectId;
  lat: number;
  lng: number;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
  source: "mobile" | "backend";
  capturedAt: Date;
  createdAt: Date;
}

const RideLocationSnapshotSchema = new Schema<IRideLocationSnapshot>({
  rideId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Ride",
    required: true,
    index: true,
  },
  driverUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  speed: { type: Number, default: null },
  heading: { type: Number, default: null },
  accuracy: { type: Number, default: null },
  source: {
    type: String,
    enum: ["mobile", "backend"],
    default: "mobile",
  },
  capturedAt: {
    type: Date,
    required: true,
    default: Date.now,
    index: true,
  },
  createdAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
});

RideLocationSnapshotSchema.index({ rideId: 1, driverUserId: 1, capturedAt: -1 });

export default mongoose.model<IRideLocationSnapshot>(
  "RideLocationSnapshot",
  RideLocationSnapshotSchema,
);

