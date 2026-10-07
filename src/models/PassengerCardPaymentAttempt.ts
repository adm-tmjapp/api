import mongoose, { Document, Schema } from "mongoose";

export interface IPassengerCardPaymentAttempt extends Document {
  passengerUserId: mongoose.Types.ObjectId;
  rideId: mongoose.Types.ObjectId;
  operation: "CARD_PAYMENT";
  status: "PROCESSING" | "COMPLETED";
  paymentId?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const PassengerCardPaymentAttemptSchema = new Schema<IPassengerCardPaymentAttempt>(
  {
    passengerUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    rideId: {
      type: Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
      index: true,
    },
    operation: {
      type: String,
      enum: ["CARD_PAYMENT"],
      required: true,
      default: "CARD_PAYMENT",
    },
    status: {
      type: String,
      enum: ["PROCESSING", "COMPLETED"],
      required: true,
      default: "PROCESSING",
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "RidePayment",
      default: null,
    },
  },
  { timestamps: true },
);

PassengerCardPaymentAttemptSchema.index(
  { passengerUserId: 1, rideId: 1, operation: 1 },
  { unique: true, name: "uniq_passenger_card_payment_attempt" },
);

export default mongoose.model<IPassengerCardPaymentAttempt>(
  "PassengerCardPaymentAttempt",
  PassengerCardPaymentAttemptSchema,
);
