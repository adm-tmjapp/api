import mongoose, { Document, Schema } from "mongoose";

export type RideMessageSenderRole = "passenger" | "driver";

export interface IRideMessage extends Document {
  rideId: string;
  senderId: string;
  senderRole: RideMessageSenderRole;
  content: string;
  readAt?: Date | null;
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
  },
  { timestamps: true },
);

RideMessageSchema.index({ rideId: 1, createdAt: 1 });

export default mongoose.model<IRideMessage>("RideMessage", RideMessageSchema);
