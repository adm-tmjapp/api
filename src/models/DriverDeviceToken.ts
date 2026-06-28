import mongoose, { Document, Schema } from "mongoose";

export interface IDriverDeviceToken extends Document {
  driverUserId: mongoose.Types.ObjectId;
  provider: "fcm";
  token: string;
  platform: "android" | "ios";
  isActive: boolean;
  lastSeenAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const DriverDeviceTokenSchema = new Schema<IDriverDeviceToken>(
  {
    driverUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ["fcm"],
      required: true,
      default: "fcm",
    },
    token: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ["android", "ios"],
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastSeenAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

DriverDeviceTokenSchema.index(
  { driverUserId: 1, token: 1 },
  { unique: true, name: "uniq_driver_device_token" },
);

export default mongoose.model<IDriverDeviceToken>(
  "DriverDeviceToken",
  DriverDeviceTokenSchema,
);
