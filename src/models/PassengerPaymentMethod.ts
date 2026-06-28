import mongoose, { Schema, Document } from "mongoose";

export interface IPassengerPaymentMethod extends Document {
  passengerUserId: mongoose.Types.ObjectId;
  type: "card" | "pix";
  provider?: string;
  providerCustomerId?: string;
  providerPaymentMethodToken?: string;
  brand?: string;
  last4?: string;
  holderName?: string;
  label?: string;
  isDefault: boolean;
  status?: "ACTIVE" | "INACTIVE";
  createdAt: Date;
  updatedAt: Date;
}

const PassengerPaymentMethodSchema = new Schema<IPassengerPaymentMethod>(
  {
    passengerUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["card", "pix"],
      required: true,
    },
    provider: {
      type: String,
      index: true,
    },
    providerCustomerId: {
      type: String,
    },
    providerPaymentMethodToken: {
      type: String,
    },
    brand: { type: String },
    last4: { type: String },
    holderName: { type: String },
    label: { type: String },
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model<IPassengerPaymentMethod>(
  "PassengerPaymentMethod",
  PassengerPaymentMethodSchema,
);
