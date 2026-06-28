import mongoose, { Schema, Document } from 'mongoose';
import User from './User';
import Ride from './Ride';

interface IPayment extends Document {
  rideId: mongoose.Schema.Types.ObjectId;
  passengerId: mongoose.Schema.Types.ObjectId;
  driverId: mongoose.Schema.Types.ObjectId;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  paymentMethod: 'credit_card' | 'debit_card' | 'cash';
}

const PaymentSchema: Schema = new Schema({
  rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true },
  passengerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  paymentMethod: { type: String, enum: ['credit_card', 'debit_card', 'cash'], required: true },
});

const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);

export default Payment;
