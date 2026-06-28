import mongoose, { Document, Schema } from "mongoose";

export interface IPaymentGatewayCustomer extends Document {
  userId: mongoose.Types.ObjectId;
  provider: string;
  providerCustomerId: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentGatewayCustomerSchema = new Schema<IPaymentGatewayCustomer>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    provider: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    providerCustomerId: {
      type: String,
      required: true,
      index: true,
      trim: true,
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

PaymentGatewayCustomerSchema.index(
  { userId: 1, provider: 1 },
  { unique: true, name: "uniq_payment_gateway_customer" },
);

export default mongoose.model<IPaymentGatewayCustomer>(
  "PaymentGatewayCustomer",
  PaymentGatewayCustomerSchema,
);
