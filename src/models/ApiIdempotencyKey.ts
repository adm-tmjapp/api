import mongoose, { Document, Schema } from "mongoose";

export interface IApiIdempotencyKey extends Document {
  driverUserId: mongoose.Types.ObjectId;
  endpoint: string;
  idempotencyKey: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  responsePayload?: any;
  errorPayload?: any;
  resourceId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ApiIdempotencyKeySchema = new Schema<IApiIdempotencyKey>({
  driverUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  endpoint: {
    type: String,
    required: true,
  },
  idempotencyKey: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["PROCESSING", "COMPLETED", "FAILED"],
    required: true,
    default: "PROCESSING",
  },
  responsePayload: {
    type: Schema.Types.Mixed,
    required: false,
  },
  errorPayload: {
    type: Schema.Types.Mixed,
    required: false,
  },
  resourceId: {
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
});

ApiIdempotencyKeySchema.index(
  { driverUserId: 1, endpoint: 1, idempotencyKey: 1 },
  { unique: true },
);

export default mongoose.model<IApiIdempotencyKey>(
  "ApiIdempotencyKey",
  ApiIdempotencyKeySchema,
);

