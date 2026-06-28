import express from "express";
import Payment from "../models/Payment";
import authMiddleware from "../middlewares/authMiddleware";

const router = express.Router();

// Registrar pagamento
router.post("/pay", authMiddleware("passenger"), async (req, res) => {
  const { rideId, driverId, amount, paymentMethod } = req.body;
  const passengerId = req.user?.id;

  try {
    const newPayment = new Payment({
      rideId,
      passengerId,
      driverId,
      amount,
      status: "pending",
      paymentMethod,
    });

    await newPayment.save();
    res.status(201).json(newPayment);
  } catch (error) {
    res.status(500).json({ message: "Erro ao realizar pagamento", error });
    return;
  }
});

export default router;
