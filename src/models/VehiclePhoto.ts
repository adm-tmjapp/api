import mongoose, { Schema, Document } from "mongoose";

export interface IVehiclePhoto extends Document {
  user: mongoose.Types.ObjectId;
  vehicle: mongoose.Types.ObjectId;

  type: "FRONT" | "BACK" | "LEFT" | "RIGHT" | "INTERIOR" | "PLATE";

  fileUrl: string;

  status: "PENDING" | "APPROVED" | "REJECTED";

  rejectionReason?: string;

  createdAt: Date;
  reviewedAt?: Date;
}

const VehiclePhotoSchema = new Schema<IVehiclePhoto>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    vehicle: {
      type: Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["FRONT", "BACK", "LEFT", "RIGHT", "INTERIOR", "PLATE"],
      required: true,
    },

    fileUrl: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },

    rejectionReason: {
      type: String,
    },

    reviewedAt: {
      type: Date,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.model<IVehiclePhoto>(
  "VehiclePhoto",
  VehiclePhotoSchema
);
