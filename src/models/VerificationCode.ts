import mongoose, { Schema, Document } from "mongoose";

export type VerificationCodeType = "EMAIL" | "PHONE" | "RESET_PASSWORD";

export interface IVerificationCode extends Document {
  userId: mongoose.Types.ObjectId;
  type: VerificationCodeType;
  code: string; // hash do código
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
}

const VerificationCodeSchema = new Schema<IVerificationCode>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },

  type: {
    type: String,
    enum: ["EMAIL", "PHONE", "RESET_PASSWORD"],
    required: true,
    index: true,
  },

  code: {
    type: String,
    required: true,
  },

  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },

  attempts: {
    type: Number,
    default: 0,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// 🔥 Índice composto (performance + segurança)
VerificationCodeSchema.index({ userId: 1, type: 1 }, { unique: true });

// 🧹 TTL automático (opcional, recomendado)
VerificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IVerificationCode>(
  "VerificationCode",
  VerificationCodeSchema
);
