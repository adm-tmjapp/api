import mongoose, { Document, Schema } from "mongoose";

export type WalletLedgerType =
  | "RIDE_CREDIT"
  | "BONUS"
  | "PIX_TRANSFER_DEBIT"
  | "ADJUSTMENT";

export interface IWalletLedgerEntry extends Document {
  driverUserId: mongoose.Types.ObjectId;
  type: WalletLedgerType;
  amount: number;
  balanceAfter: number;
  referenceType?: string;
  referenceId?: string;
  createdAt: Date;
}

const WalletLedgerEntrySchema = new Schema<IWalletLedgerEntry>({
  driverUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ["RIDE_CREDIT", "BONUS", "PIX_TRANSFER_DEBIT", "ADJUSTMENT"],
    required: true,
    index: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  balanceAfter: {
    type: Number,
    required: true,
  },
  referenceType: {
    type: String,
    required: false,
  },
  referenceId: {
    type: String,
    required: false,
  },
  createdAt: {
    type: Date,
    required: true,
    default: Date.now,
    index: true,
  },
});

WalletLedgerEntrySchema.index({ driverUserId: 1, createdAt: -1 });
WalletLedgerEntrySchema.index({ driverUserId: 1, type: 1, createdAt: -1 });

export default mongoose.model<IWalletLedgerEntry>(
  "WalletLedgerEntry",
  WalletLedgerEntrySchema,
);

