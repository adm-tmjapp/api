import mongoose, { Schema, Document } from "mongoose";

export interface IDriver extends Document {
  userId: mongoose.Types.ObjectId;
  carModel: string;
  licenseNumber: string;
  vehicle: {
    make: string;
    model: string;
    year: number;
    plate: string;
  };
  location: {
    type: string;
    coordinates: number[];
  };
  isAvailable: boolean;
  lastLocationAt?: Date | null;
  lastHeading?: number | null;
  lastSpeed?: number | null;
  lastAccuracy?: number | null;
}

const DriverSchema = new Schema<IDriver>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  licenseNumber: { type: String, required: true },
  vehicle: {
    make: { type: String, required: true },
    model: { type: String, required: true },
    year: { type: Number, required: true },
    plate: { type: String, required: true },
  },
  location: {
    type: { type: String, default: "Point" },
    coordinates: { type: [Number], required: true },
  },
  isAvailable: { type: Boolean, default: true },
  lastLocationAt: { type: Date, default: null, index: true },
  lastHeading: { type: Number, default: null },
  lastSpeed: { type: Number, default: null },
  lastAccuracy: { type: Number, default: null },
});

DriverSchema.index({ location: "2dsphere" });
DriverSchema.index({ isAvailable: 1, lastLocationAt: -1 });

export default mongoose.model<IDriver>("Driver", DriverSchema);
