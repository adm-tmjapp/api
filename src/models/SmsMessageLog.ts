import mongoose, { Document, Schema } from "mongoose";

export interface ISmsMessageLog extends Document {
  userId?: mongoose.Types.ObjectId;
  phone: string;
  provider: "AWS_SNS";
  type: "OTP";
  status: "SENT" | "FAILED";
  messageId?: string;
  errorMessage?: string;
  createdAt: Date;
}

const SmsMessageLogSchema = new Schema<ISmsMessageLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    phone: {
      type: String,
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ["AWS_SNS"],
      default: "AWS_SNS",
      required: true,
    },
    type: {
      type: String,
      enum: ["OTP"],
      default: "OTP",
      required: true,
    },
    status: {
      type: String,
      enum: ["SENT", "FAILED"],
      required: true,
      index: true,
    },
    messageId: {
      type: String,
    },
    errorMessage: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: false }
);

export default mongoose.model<ISmsMessageLog>(
  "SmsMessageLog",
  SmsMessageLogSchema
);
