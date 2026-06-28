import mongoose, { Schema, Document } from "mongoose";

export interface IPassengerNotification extends Document {
  passengerUserId: mongoose.Types.ObjectId;
  title: string;
  body: string;
  read: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const PassengerNotificationSchema = new Schema<IPassengerNotification>(
  {
    passengerUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model<IPassengerNotification>(
  "PassengerNotification",
  PassengerNotificationSchema,
);
