import mongoose, { Document, Schema } from "mongoose";

export interface IDriverWallet extends Document {
  driverUserId: mongoose.Types.ObjectId;
  availableBalance: number;
  pendingBalance: number;
  updatedAt: Date;
  createdAt: Date;
}

const DriverWalletSchema = new Schema<IDriverWallet>({
  driverUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
    index: true,
  },
  availableBalance: {
    type: Number,
    required: true,
    default: 0,
  },
  pendingBalance: {
    type: Number,
    required: true,
    default: 0,
  },
  updatedAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
});

export default mongoose.model<IDriverWallet>("DriverWallet", DriverWalletSchema);

