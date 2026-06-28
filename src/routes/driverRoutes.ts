import express, { NextFunction, Request, Response } from "express";
import Driver from "../models/Driver";
import authMiddleware from "../middlewares/authMiddleware";
import Vehicle from "../models/Vehicle";
import User from "../models/User";

const router = express.Router();

/**
 * @swagger
 * /drivers/register:
 *   post:
 *     summary: Registrar motorista
 *     tags: [Motorista]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               licenseNumber:
 *                 type: string
 *               vehicle:
 *                 type: string
 *     responses:
 *       201:
 *         description: Motorista registrado
 *       500:
 *         description: Erro ao registrar motorista
 */

/**
 * @swagger
 *
 * /drivers/profile/{userId}:
 *   get:
 *     tags:
 *       - Motorista
 *     summary: Exibir perfil do motorista
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do usuário.
 *
 *     responses:
 *       200:
 *         description: Dados do veículo.
 *       404:
 *         description: Veículo não encontrado.
 *
 */

// Registrar motorista
router.post("/register", authMiddleware(), async (req, res) => {
  const { licenseNumber, vehicle } = req.body;
  const userId = (req as any).user?.id;

  try {
    const newDriver = new Driver({ userId, licenseNumber, vehicle });
    await newDriver.save();
    res.status(201).json({ message: "Motorista registrado", newDriver });
  } catch (error) {
    res.status(500).json({ message: "Erro ao registrar motorista", error });
  }
});

// Exibir perfil do motorista

router.get(
  "/profile/:userId",
  authMiddleware(),
  async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { userId } = req.params;

      const userObj = await User.findOne({ userId });

      // Buscar veículo pelo userId e retornar apenas id e status
      const vehicleObj = await Vehicle.findOne({ userId }, "_id status");
      if (!vehicleObj) {
        return res.status(404).json({ message: "Veículo não encontrado" });
      }

      const profile = { user: userObj, vehicle: vehicleObj };

      res.json(profile);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Erro ao buscar perfil do motorista", error });
    }
  }
);

export default router;
