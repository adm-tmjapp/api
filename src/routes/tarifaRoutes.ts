import express, { NextFunction, Request, Response } from "express";
import Tarifa from "../models/Tarifa";

const router = express.Router();

/**
 * @swagger
 * /tarifas:
 *   post:
 *     summary: Cadastrar nova tarifa
 *     tags: [Tarifa]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               valorBase:
 *                 type: number
 *               valorKm:
 *                 type: number
 *               custoFixo:
 *                 type: number
 *               taxaIntermediacao:
 *                 type: number
 *               vigenciaInicio:
 *                 type: string
 *                 format: date-time
 *               vigenciaFim:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Tarifa cadastrada com sucesso
 *       400:
 *         description: Erro de validação
 *       500:
 *         description: Erro no servidor
 */

router.post(
  "/",
  async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const tarifa = new Tarifa(req.body);
      await tarifa.save();
      res.status(201).json(tarifa);
    } catch (err) {
      if (err instanceof Error) {
        res.status(500).json({ error: err.message });
      } else {
        res.status(500).json({ error: "Erro desconhecido" });
      }
    }
  }
);

/**
 * @swagger
 * /tarifas:
 *   get:
 *     summary: Listar todas as tarifas
 *     tags: [Tarifa]
 *     responses:
 *       200:
 *         description: Lista de tarifas
 *       500:
 *         description: Erro no servidor
 */
router.get("/", async (_req, res) => {
  try {
    const tarifas = await Tarifa.find().sort({ vigenciaInicio: -1 });
    res.json(tarifas);
  } catch (err) {
    if (err instanceof Error) {
      res.status(500).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Erro desconhecido" });
    }
  }
});

/**
 * @swagger
 * /tarifas/{id}:
 *   put:
 *     summary: Alterar uma tarifa existente
 *     tags: [Tarifa]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da tarifa a ser alterada
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               valorBase:
 *                 type: number
 *               valorKm:
 *                 type: number
 *               custoFixo:
 *                 type: number
 *               taxaIntermediacao:
 *                 type: number
 *               vigenciaInicio:
 *                 type: string
 *                 format: date-time
 *               vigenciaFim:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Tarifa atualizada com sucesso
 *       404:
 *         description: Tarifa não encontrada
 *       500:
 *         description: Erro no servidor
 */
router.put(
  "/:id",
  async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { id } = req.params;
      const tarifaAtualizada = await Tarifa.findByIdAndUpdate(id, req.body, {
        new: true,
      });

      if (!tarifaAtualizada) {
        return res.status(404).json({ error: "Tarifa não encontrada" });
      }

      res.json(tarifaAtualizada);
    } catch (err) {
      if (err instanceof Error) {
        res.status(500).json({ error: err.message });
      } else {
        res.status(500).json({ error: "Erro desconhecido" });
      }
    }
  }
);

/**
 * @swagger
 * /tarifas/{id}:
 *   delete:
 *     summary: Excluir uma tarifa existente
 *     tags: [Tarifa]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da tarifa a ser excluída
 *     responses:
 *       200:
 *         description: Tarifa excluída com sucesso
 *       404:
 *         description: Tarifa não encontrada
 *       500:
 *         description: Erro no servidor
 */
router.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { id } = req.params;
      const tarifaExcluida = await Tarifa.findByIdAndDelete(id);

      if (!tarifaExcluida) {
        return res.status(404).json({ error: "Tarifa não encontrada" });
      }

      res.json({ message: "Tarifa excluída com sucesso" });
    } catch (err) {
      if (err instanceof Error) {
        res.status(500).json({ error: err.message });
      } else {
        res.status(500).json({ error: "Erro desconhecido" });
      }
    }
  }
);

export default router;
