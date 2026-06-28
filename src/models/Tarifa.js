// models/Tarifa.js
const mongoose = require('mongoose');

const TarifaSchema = new mongoose.Schema({
  valorBase: { type: Number, required: true },
  valorKm: { type: Number, required: true },
  custoFixo: { type: Number, required: true }, // porcentagem
  taxaIntermediacao: { type: Number, required: true }, // porcentagem
  vigenciaInicio: { type: Date, required: true },
  vigenciaFim: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Tarifa', TarifaSchema);
