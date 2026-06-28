import mongoose, { Document, Schema } from "mongoose";

export type DriverTransferStatus = "PENDING" | "COMPLETED" | "FAILED";

export interface IDriverTransfer extends Document {
  driverUserId: mongoose.Types.ObjectId;
  method: "PIX_CPF";
  cpfMasked: string;
  cpfHash: string;
  amount: number;
  status: DriverTransferStatus;
  providerTxId?: string | null;
  receiptUrl?: string | null;
  failureReason?: string | null;
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
    enum: ["PENDING", "COMPLETED", "FAILED"],
    required: true,
    default: "PENDING",
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

export default mongoose.model<IDriverTransfer>(
  "DriverTransfer",
  DriverTransferSchema,
);

