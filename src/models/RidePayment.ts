import mongoose, { Document, Schema } from "mongoose";

export type RidePaymentBillingType = "PIX" | "CREDIT_CARD";
export type RidePaymentStatus =
  | "PENDING"
  | "WAITING_PIX_PAYMENT"
  | "AUTHORIZED"
  | "PAID"
  | "FAILED"
  | "CANCELED"
  | "REFUNDED"
  | "CHARGEBACK";

export interface IRidePayment extends Document {
  rideId: mongoose.Types.ObjectId;
  passengerId: mongoose.Types.ObjectId;
  driverId?: mongoose.Types.ObjectId | null;
  provider: string;
  providerPaymentId?: string | null;
  providerCustomerId?: string | null;
  paymentMethodId?: mongoose.Types.ObjectId | null;
  billingType: RidePaymentBillingType;
  status: RidePaymentStatus;
  grossAmount: number;
  platformCommissionAmount: number;
  providerFeeAmount: number;
  driverNetAmount: number;
  platformNetAmount: number;
  invoiceUrl?: string | null;
  receiptUrl?: string | null;
  pixPayload?: string | null;
  pixEncodedImage?: string | null;
  pixExpirationDate?: Date | null;
  providerPayload?: Record<string, unknown>;
  paidAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const RidePaymentSchema = new Schema<IRidePayment>(
  {
    rideId: {
      type: Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
      index: true,
    },
    passengerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    driverId: {
      type: Schema.Types.ObjectId,
      ref: "Driver",
      default: null,
      index: true,
    },
    provider: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    providerPaymentId: {
      type: String,
      default: null,
      index: true,
      trim: true,
    },
    providerCustomerId: {
      type: String,
      default: null,
      trim: true,
    },
    paymentMethodId: {
      type: Schema.Types.ObjectId,
      ref: "PassengerPaymentMethod",
      default: null,
    },
    billingType: {
      type: String,
      enum: ["PIX", "CREDIT_CARD"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        "PENDING",
        "WAITING_PIX_PAYMENT",
        "AUTHORIZED",
        "PAID",
        "FAILED",
        "CANCELED",
        "REFUNDED",
        "CHARGEBACK",
      ],
      required: true,
      index: true,
    },
    grossAmount: { type: Number, required: true },
    platformCommissionAmount: { type: Number, required: true, default: 0 },
    providerFeeAmount: { type: Number, required: true, default: 0 },
    driverNetAmount: { type: Number, required: true, default: 0 },
    platformNetAmount: { type: Number, required: true, default: 0 },
    invoiceUrl: { type: String, default: null },
    receiptUrl: { type: String, default: null },
    pixPayload: { type: String, default: null },
    pixEncodedImage: { type: String, default: null },
    pixExpirationDate: { type: Date, default: null },
    providerPayload: { type: Schema.Types.Mixed, default: undefined },
    paidAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
);

RidePaymentSchema.index(
  { provider: 1, providerPaymentId: 1 },
  {
    unique: true,
    sparse: true,
    name: "uniq_provider_payment_id",
  },
);

export default mongoose.model<IRidePayment>("RidePayment", RidePaymentSchema);
