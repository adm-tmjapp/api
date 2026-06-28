import mongoose, { Schema, Document } from "mongoose";

export interface IRide extends Document {
  passengerId?: string;
  status?: "pending" | "accepted" | "ongoing" | "completed" | "canceled";
  requestedAt?: Date;
  acceptedAt?: Date;
  arrivedAt?: Date;
  pickedUpAt?: Date;
  completedAt?: Date;
  rider?: {
    id?: string;
    name?: string;
    phone_number?: string;
    photo_url?: string;
  };
  driver?: {
    id?: string;
    name?: string;
    rating?: number;
    phone_number?: string;
    photo_url?: string;
  };
  vehicle?: {
    license_plate?: string;
    model?: string;
    color?: string;
    type?: string;
  };
  fare?: {
    currency?: string;
    total_amount?: number;
    breakdown?: {
      base_fare?: number;
      distance_fee?: number;
      time_fee?: number;
      service_fee?: number;
    };
  };
  pickup_location?: {
    address?: string;
    coordinates?: {
      latitude?: number;
      longitude?: number;
    };
  };
  destination_location?: {
    address?: string;
    coordinates?: {
      latitude?: number;
      longitude?: number;
    };
  };
  route?: {
    distance_km?: number;
    duration_min?: number;
    encoded_polyline?: string;
  };
  payment_method?: string;
  notes?: string;
  product?: {
    id: string;
    name: string;
    price: number;
    description?: string;
    fare_breakdown?: {
      valorBase?: number;
      valorKm?: number;
      custoFixo?: number;
      taxaIntermediacao?: number;
      subtotal?: number;
      valorTaxa?: number;
    };
  };
}

const RideSchema = new Schema<IRide>({
  passengerId: {
    type: String,
    index: true,
    required: false,
  },
  product: {
    id: { type: String },
    name: { type: String },
    price: { type: Number },
    description: { type: String },
    fare_breakdown: {
      valorBase: { type: Number },
      valorKm: { type: Number },
      custoFixo: { type: Number },
      taxaIntermediacao: { type: Number },
      subtotal: { type: Number },
      valorTaxa: { type: Number },
    },
  },
  payment_method: { type: String, required: false },
  status: {
    type: String,
    enum: ["pending", "accepted", "ongoing", "completed", "canceled"],
    required: false,
  },
  requestedAt: { type: Date, required: false },
  acceptedAt: { type: Date, required: false },
  arrivedAt: { type: Date, required: false },
  pickedUpAt: { type: Date, required: false },
  completedAt: { type: Date, required: false },
  rider: {
    id: { type: String, required: false },
    name: { type: String, required: false },
    phone_number: { type: String, required: false },
    photo_url: { type: String, required: false },
  },
  driver: {
    id: { type: String, required: false },
    name: { type: String, required: false },
    rating: { type: Number, required: false },
    phone_number: { type: String, required: false },
    photo_url: { type: String, required: false },
  },
  vehicle: {
    license_plate: { type: String, required: false },
    model: { type: String, required: false },
    color: { type: String, required: false },
    type: { type: String, required: false },
  },
  fare: {
    currency: { type: String, required: false },
    total_amount: { type: Number, required: false },
    breakdown: {
      base_fare: { type: Number, required: false },
      distance_fee: { type: Number, required: false },
      time_fee: { type: Number, required: false },
      service_fee: { type: Number, required: false },
    },
  },
  pickup_location: {
    address: { type: String, required: false },
    coordinates: {
      latitude: { type: Number, required: false },
      longitude: { type: Number, required: false },
    },
  },
  destination_location: {
    address: { type: String, required: false },
    coordinates: {
      latitude: { type: Number, required: false },
      longitude: { type: Number, required: false },
    },
  },
  route: {
    distance_km: { type: Number, required: false },
    duration_min: { type: Number, required: false },
    encoded_polyline: { type: String, required: false },
  },
  notes: { type: String, required: false },
});

export default mongoose.model<IRide>("Ride", RideSchema);
