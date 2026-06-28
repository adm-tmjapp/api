import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  phone: string;
  cpf?: string;

  role: "passenger" | "driver" | "admin";

  emailVerified: boolean;
  phoneVerified: boolean;

  authStatus: "PENDING_EMAIL" | "PENDING_PHONE" | "ACTIVE" | "BLOCKED";

  emailValidation?: {
    email: string;
    code: string;
    status: "pending" | "verified";
    sentAt: Date;
  };

  resetValidation?: {
    email: string;
    code: string;
    status: "pending" | "verified";
    sentAt: Date;
  };

  phoneValidation?: {
    phone: string;
    code: string;
    status: "pending" | "verified";
    sentAt: Date;
  };

  profilePhoto?: string;
  address?: {
    street: string;
    number: string;
    district: string;
    city: string;
    state: string;
    zipCode: string;
    complement?: string;
    latitude: number;
    longitude: number;
    formattedAddress: string;
  };
  addressHistory?: Array<{
    label?: string;
    street?: string;
    number?: string;
    district?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    complement?: string;
    latitude: number;
    longitude: number;
    formattedAddress: string;
    createdAt: Date;
  }>;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true,
  },

  password: { type: String, required: true },

  phone: {
    type: String,
    required: true,
    index: true,
  },

  cpf: {
    type: String,
    required: false,
    index: true,
  },

  role: {
    type: String,
    enum: ["passenger", "driver", "admin"],
    required: true,
  },

  emailVerified: {
    type: Boolean,
    default: false,
  },

  phoneVerified: {
    type: Boolean,
    default: false,
  },

  authStatus: {
    type: String,
    enum: ["PENDING_EMAIL", "PENDING_PHONE", "ACTIVE", "BLOCKED"],
    default: "PENDING_EMAIL",
    index: true,
  },

  emailValidation: {
    email: { type: String },
    code: { type: String },
    status: {
      type: String,
      enum: ["pending", "verified"],
      default: "pending",
    },
    sentAt: { type: Date },
  },

  phoneValidation: {
    phone: { type: String },
    code: { type: String },
    status: {
      type: String,
      enum: ["pending", "verified"],
      default: "pending",
    },
    sentAt: { type: Date },
  },

  resetValidation: {
    email: { type: String },
    code: { type: String },
    status: {
      type: String,
      enum: ["pending", "verified"],
      default: "pending",
    },
    sentAt: { type: Date },
  },

  profilePhoto: { type: String },

  address: {
    street: { type: String },
    number: { type: String },
    district: { type: String },
    city: { type: String },
    state: { type: String },
    zipCode: { type: String },
    complement: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
    formattedAddress: { type: String },
  },

  addressHistory: [
    new Schema(
      {
        label: { type: String },
        street: { type: String },
        number: { type: String },
        district: { type: String },
        city: { type: String },
        state: { type: String },
        zipCode: { type: String },
        complement: { type: String },
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
        formattedAddress: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
      { _id: true }
    ),
  ],

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model<IUser>("User", UserSchema);
