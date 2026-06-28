import mongoose, { Schema, Document } from "mongoose";

export interface IVehicle extends Document {
  userId: mongoose.Types.ObjectId;
  vehicleType: string;
  manufacturer: string;
  modelName: string;
  year?: string;
  color: string;
  vehiclePlate: string;
  usage?: "ENTREGAS" | "PASSAGEIROS" | "AMBOS";
  renavam?: string;
  photo?: mongoose.Types.ObjectId; // referência para VehiclePhoto
  status?: "PENDING" | "APPROVED" | "REJECTED";
  documentationStatus?: "PENDING" | "APPROVED" | "REJECTED" | "UNDER_REVIEW";
  activationStatus?: "ACTIVE" | "INACTIVE" | "BLOCKED";
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  documents?: mongoose.Types.ObjectId[];
}

const VehicleSchema: Schema = new Schema<IVehicle>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    vehicleType: { type: String, required: true },
    manufacturer: { type: String, required: true },
    modelName: { type: String, required: true },
    year: { type: String },
    color: { type: String, required: true },
    vehiclePlate: { type: String, required: true },
    usage: {
      type: String,
      enum: ["ENTREGAS", "PASSAGEIROS", "AMBOS"],
    },
    renavam: { type: String, unique: true, sparse: true },
    photo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VehiclePhoto",
    },
    documents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DriverDocument",
      },
    ],
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
    documentationStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "UNDER_REVIEW"],
      default: "PENDING",
      index: true,
    },
    activationStatus: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "BLOCKED"],
      default: "INACTIVE",
      index: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true, // cria createdAt e updatedAt automaticamente
  }
);

export default mongoose.model<IVehicle>("Vehicle", VehicleSchema);
