import mongoose, { Document, Schema } from "mongoose";

export interface IRidePaymentEvent extends Document {
  ridePaymentId?: mongoose.Types.ObjectId | null;
  provider: string;
  providerEvent: string;
  providerPaymentId?: string | null;
  payload: Record<string, unknown>;
  processed: boolean;
  processedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const RidePaymentEventSchema = new Schema<IRidePaymentEvent>(
  {
    ridePaymentId: {
      type: Schema.Types.ObjectId,
      ref: "RidePayment",
      default: null,
      index: true,
    },
    provider: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    providerEvent: {
      type: String,
      required: true,
      trim: true,
    },
    providerPaymentId: {
      type: String,
      default: null,
      index: true,
      trim: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    processed: {
      type: Boolean,
      default: false,
      index: true,
    },
    processedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model<IRidePaymentEvent>(
  "RidePaymentEvent",
  RidePaymentEventSchema,
);
