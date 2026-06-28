import mongoose, { Document, Schema } from "mongoose";

export type PaymentSettingsScopeType =
  | "GLOBAL"
  | "CITY"
  | "PRODUCT"
  | "OPERATION";

export interface IPaymentSettings extends Document {
  scopeType: PaymentSettingsScopeType;
  scopeId?: string | null;
  enabledMethods: Array<"PIX" | "CREDIT_CARD">;
  defaultMethod?: "PIX" | "CREDIT_CARD" | null;
  allowSavedCard: boolean;
  pixEnabled: boolean;
  creditCardEnabled: boolean;
  provider?: string | null;
  providerStrategy?: string | null;
  providerPriority?: number | null;
  updatedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSettingsSchema = new Schema<IPaymentSettings>(
  {
    scopeType: {
      type: String,
      enum: ["GLOBAL", "CITY", "PRODUCT", "OPERATION"],
      required: true,
      index: true,
    },
    scopeId: {
      type: String,
      default: null,
      index: true,
    },
    enabledMethods: {
      type: [String],
      enum: ["PIX", "CREDIT_CARD"],
      default: ["PIX", "CREDIT_CARD"],
    },
    defaultMethod: {
      type: String,
      enum: ["PIX", "CREDIT_CARD"],
      default: "PIX",
    },
    allowSavedCard: {
      type: Boolean,
      default: false,
    },
    pixEnabled: {
      type: Boolean,
      default: true,
    },
    creditCardEnabled: {
      type: Boolean,
      default: true,
    },
    provider: {
      type: String,
      default: null,
    },
    providerStrategy: {
      type: String,
      default: null,
    },
    providerPriority: {
      type: Number,
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

PaymentSettingsSchema.index(
  { scopeType: 1, scopeId: 1 },
  { unique: true, name: "uniq_payment_settings_scope" },
);

export default mongoose.model<IPaymentSettings>(
  "PaymentSettings",
  PaymentSettingsSchema,
);
