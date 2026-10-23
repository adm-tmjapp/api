import mongoose, { Document, Schema } from "mongoose";

export interface IPassengerDeviceToken extends Document {
  passengerUserId: mongoose.Types.ObjectId;
  provider: "fcm";
  token: string;
  platform: "android" | "ios";
  isActive: boolean;
  lastSeenAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IPassengerDeviceToken>({
  passengerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  provider: { type: String, enum: ["fcm"], default: "fcm", required: true },
  token: { type: String, required: true, trim: true, index: true },
  platform: { type: String, enum: ["android", "ios"], required: true },
  isActive: { type: Boolean, default: true, index: true },
  lastSeenAt: { type: Date, default: null },
}, { timestamps: true });

schema.index({ passengerUserId: 1, token: 1 }, { unique: true, name: "uniq_passenger_device_token" });

export default mongoose.model<IPassengerDeviceToken>("PassengerDeviceToken", schema);
