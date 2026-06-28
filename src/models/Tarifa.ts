import mongoose, { Document, Schema } from "mongoose";

export interface ITarifa extends Document {
  label?: string;
  valorBase: number;
  valorKm: number;
  custoFixo: number; // porcentagem
  taxaIntermediacao: number; // porcentagem
  vigenciaInicio: Date;
  vigenciaFim: Date;
  createdAt: Date;
  status?: boolean;
}

const TarifaSchema = new Schema<ITarifa>({
  label: { type: String },
  valorBase: { type: Number, required: true },
  valorKm: { type: Number, required: true },
  custoFixo: { type: Number, required: true },
  taxaIntermediacao: { type: Number, required: true },
  vigenciaInicio: { type: Date, required: true },
  vigenciaFim: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  status: { type: Boolean, default: true },
});

const Tarifa = mongoose.model<ITarifa>("Tarifa", TarifaSchema);
export default Tarifa;
