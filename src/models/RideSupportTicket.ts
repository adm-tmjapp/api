import mongoose, { Document, Schema } from "mongoose";

export type RideSupportIssueCode =
  | "FORGOTTEN_OBJECT"
  | "PAYMENT_ISSUE"
  | "SECURITY_INCIDENT"
  | "PASSENGER_ABSENT"
  | "OTHER";

export type RideSupportTicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "UNDER_REVIEW"
  | "RESOLVED";

export interface IRideSupportTicket extends Document {
  rideId: mongoose.Types.ObjectId;
  driverUserId: mongoose.Types.ObjectId;
  issueCode: RideSupportIssueCode;
  subject?: string;
  description?: string;
  attachments?: string[];
  metadata?: Record<string, unknown>;
  status: RideSupportTicketStatus;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

const RideSupportTicketSchema = new Schema<IRideSupportTicket>({
  rideId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Ride",
    required: true,
    index: true,
  },
  driverUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  issueCode: {
    type: String,
    enum: [
      "FORGOTTEN_OBJECT",
      "PAYMENT_ISSUE",
      "SECURITY_INCIDENT",
      "PASSENGER_ABSENT",
      "OTHER",
    ],
    required: true,
    index: true,
  },
  subject: {
    type: String,
    required: false,
  },
  description: {
    type: String,
    required: false,
  },
  attachments: {
    type: [String],
    required: false,
    default: [],
  },
  metadata: {
    type: Schema.Types.Mixed,
    required: false,
  },
  status: {
    type: String,
    enum: ["OPEN", "IN_PROGRESS", "UNDER_REVIEW", "RESOLVED"],
    required: true,
    default: "OPEN",
    index: true,
  },
  message: {
    type: String,
    required: true,
    default: "Ticket criado com sucesso.",
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

RideSupportTicketSchema.index({ driverUserId: 1, createdAt: -1 });

export default mongoose.model<IRideSupportTicket>(
  "RideSupportTicket",
  RideSupportTicketSchema,
);
