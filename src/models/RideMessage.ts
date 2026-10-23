import mongoose, { Document, Schema } from "mongoose";

export type RideMessageSenderRole = "passenger" | "driver";

export interface IRideMessage extends Document {
  rideId: string;
  senderId: string;
  senderRole: RideMessageSenderRole;
  content: string;
  readAt?: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RideMessageSchema = new Schema<IRideMessage>(
  {
    rideId: { type: String, required: true, index: true },
    senderId: { type: String, required: true, index: true },
    senderRole: {
      type: String,
      enum: ["passenger", "driver"],
      required: true,
      index: true,
    },
    content: { type: String, required: true, trim: true, maxlength: 500 },
    readAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  },
  { timestamps: true },
);

RideMessageSchema.index({ rideId: 1, createdAt: 1 });
RideMessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IRideMessage>("RideMessage", RideMessageSchema);
