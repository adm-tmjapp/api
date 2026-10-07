import mongoose, { Document, Schema } from "mongoose";

export type DriverTransferStatus =
  | "REQUESTED"
  | "APPROVED"
  | "PROCESSING"
  | "COMPLETED"
  | "REJECTED"
  | "FAILED"
  | "CANCELLED";

export interface IDriverTransfer extends Document {
  driverUserId: mongoose.Types.ObjectId;
  method: "PIX_CPF";
  pixKeyType: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";
  pixKeyMasked: string;
  pixKeyEncrypted: string;
  cpfMasked: string;
  cpfHash: string;
  amount: number;
  status: DriverTransferStatus;
  providerTxId?: string | null;
  receiptUrl?: string | null;
  failureReason?: string | null;
  rejectionReason?: string | null;
  reviewedBy?: mongoose.Types.ObjectId | null;
  reviewedAt?: Date | null;
  providerStatus?: string | null;
  providerReceiptUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date | null;
  failedAt?: Date | null;
}

const DriverTransferSchema = new Schema<IDriverTransfer>({
  driverUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  method: {
    type: String,
    enum: ["PIX_CPF"],
    required: true,
    default: "PIX_CPF",
  },
  pixKeyType: {
    type: String,
    enum: ["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"],
    default: "CPF",
    required: true,
  },
  pixKeyMasked: {
    type: String,
    required: true,
    default: "***",
  },
  pixKeyEncrypted: {
    type: String,
    required: true,
    default: "",
  },
  cpfMasked: {
    type: String,
    required: true,
  },
  cpfHash: {
    type: String,
    required: true,
    index: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: [
      "REQUESTED",
      "APPROVED",
      "PROCESSING",
      "COMPLETED",
      "REJECTED",
      "FAILED",
      "CANCELLED",
    ],
    required: true,
    default: "REQUESTED",
    index: true,
  },
  providerTxId: {
    type: String,
    default: null,
  },
  receiptUrl: {
    type: String,
    default: null,
  },
  failureReason: {
    type: String,
    default: null,
  },
  rejectionReason: {
    type: String,
    default: null,
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  reviewedAt: {
    type: Date,
    default: null,
  },
  providerStatus: {
    type: String,
    default: null,
  },
  providerReceiptUrl: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  completedAt: {
    type: Date,
    default: null,
  },
  failedAt: {
    type: Date,
    default: null,
  },
});

DriverTransferSchema.index({ driverUserId: 1, createdAt: -1 });
DriverTransferSchema.index({ status: 1, createdAt: -1 });
DriverTransferSchema.index({ providerTxId: 1 }, { sparse: true });

export default mongoose.model<IDriverTransfer>(
  "DriverTransfer",
  DriverTransferSchema,
);
