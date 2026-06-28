import mongoose, { Schema, Document } from "mongoose";

export interface IProduct extends Document {
  name: string;
  icon?: string;
  taxaId?: mongoose.Types.ObjectId;
}

const ProductSchema: Schema = new Schema<IProduct>(
  {
    name: { type: String, required: true },
    icon: { type: String },
    taxaId: { type: mongoose.Schema.Types.ObjectId, ref: "Tarifa" },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IProduct>("Product", ProductSchema);
