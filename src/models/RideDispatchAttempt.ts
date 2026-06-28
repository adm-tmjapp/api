import mongoose, { Document, Schema } from "mongoose";

export interface IRideDispatchAttempt extends Document {
  rideId: mongoose.Types.ObjectId;
  dispatchRound: number;
  radiusKm: number;
  candidateDriverUserIds: mongoose.Types.ObjectId[];
  notifiedDriverUserIds: mongoose.Types.ObjectId[];
  acceptedDriverUserId?: mongoose.Types.ObjectId | null;
  status: "OPEN" | "ACCEPTED" | "EXPIRED" | "CANCELED";
  startedAt: Date;
  expiresAt: Date;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const RideDispatchAttemptSchema = new Schema<IRideDispatchAttempt>(
  {
    rideId: {
      type: Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
      index: true,
    },
    dispatchRound: {
      type: Number,
      required: true,
    },
    radiusKm: {
      type: Number,
      required: true,
    },
    candidateDriverUserIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    notifiedDriverUserIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    acceptedDriverUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: ["OPEN", "ACCEPTED", "EXPIRED", "CANCELED"],
      default: "OPEN",
      index: true,
    },
    startedAt: {
      type: Date,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

RideDispatchAttemptSchema.index(
  { rideId: 1, dispatchRound: 1 },
  { unique: true, name: "uniq_ride_dispatch_round" },
);

export default mongoose.model<IRideDispatchAttempt>(
  "RideDispatchAttempt",
  RideDispatchAttemptSchema,
);
