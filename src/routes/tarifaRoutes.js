// routes/tarifaRoutes.js
const express = require('express');
const router = express.Router();
const Tarifa = require('../models/Tarifa');

// Salvar nova tarifa
router.post('/', async (req, res) => {
  try {
    const tarifa = new Tarifa(req.body);
    await tarifa.save();
    res.status(201).json(tarifa);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Buscar tarifa vigente (por data atual)
router.get('/vigente', async (req, res) => {
  try {
    const hoje = new Date();
    const tarifa = await Tarifa.findOne({
      vigenciaInicio: { $lte: hoje },
      vigenciaFim: { $gte: hoje }
    }).sort({ vigenciaInicio: -1 });
    if (!tarifa) return res.status(404).json({ error: 'Nenhuma tarifa vigente.' });
    res.json(tarifa);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Listar todas as tarifas
router.get('/', async (req, res) => {
  try {
    const tarifas = await Tarifa.find().sort({ vigenciaInicio: -1 });
    res.json(tarifas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
