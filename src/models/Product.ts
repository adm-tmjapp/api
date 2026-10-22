import mongoose, { Schema, Document } from "mongoose";

export interface IProduct extends Document {
  name: string;
  icon?: string;
  taxaId?: mongoose.Types.ObjectId;
  active: boolean;
}

const ProductSchema: Schema = new Schema<IProduct>(
  {
    name: { type: String, required: true },
    icon: { type: String },
    taxaId: { type: mongoose.Schema.Types.ObjectId, ref: "Tarifa" },
    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IProduct>("Product", ProductSchema);
