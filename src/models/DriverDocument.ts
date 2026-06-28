import mongoose, { Schema, Document } from "mongoose";

export interface IDriverDocument extends Document {
  user: mongoose.Types.ObjectId;

  type:
    | "CNH"
    | "CRLV"
    | "RG"
    | "CPF"
    | "SELFIE"
    | "OUTRO"
    | "RESIDENCE_PROOF"
    | "CRIMINAL_RECORD";
  side?: "FRONT" | "BACK";

  filename?: string;
  fileUrl: string;

  status: "PENDING" | "APPROVED" | "REJECTED";

  rejectionReason?: string;

  createdAt: Date;
  reviewedAt?: Date;
}

const DriverDocumentSchema = new Schema<IDriverDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: [
        "CNH",
        "CRLV",
        "RG",
        "CPF",
        "SELFIE",
        "OUTRO",
        "RESIDENCE_PROOF",
        "CRIMINAL_RECORD",
      ],
      required: true,
    },

    side: {
      type: String,
      enum: ["FRONT", "BACK"],
    },

    fileUrl: {
      type: String,
      required: true,
    },

    filename: {
      type: String,
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

export default mongoose.model<IDriverDocument>(
  "DriverDocument",
  DriverDocumentSchema
);
