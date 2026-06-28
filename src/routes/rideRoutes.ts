import express, { NextFunction, Request, Response } from "express";
import authMiddleware from "../middlewares/authMiddleware";
import Ride from "../models/Ride";

const router = express.Router();

function legacyRideRouteRemoved(res: Response, endpoint: string) {
  res.status(410).json({
    success: false,
    message: "Endpoint legado desativado. Utilize a API v2 de corridas.",
    code: "LEGACY_RIDE_ROUTE_REMOVED",
    details: {
      endpoint,
      migrationBasePath: "/api/v2/passenger/rides",
    },
  });
}

/**
 * @swagger
 * /rides/protected:
 *   get:
 *     summary: Rota protegida para usuários autenticados
 *     tags: [Corrida]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usuário autenticado acessou a rota
 */

/**
 * @swagger
 * /rides/request:
 *   post:
 *     summary: Criar uma nova corrida (apenas passageiro)
 *     tags: [Corrida]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               passengerId:
 *                 type: string
 *               origin:
 *                 type: string
 *               destination:
 *                 type: string
 *               fare:
 *                 type: number
 *     responses:
 *       410:
 *         description: Endpoint legado desativado. Utilize a API v2.
 */

/**
 * @swagger
 * /rides/pending:
 *   get:
 *     summary: Listar corridas pendentes (apenas motorista)
 *     tags: [Corrida]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       410:
 *         description: Endpoint legado desativado. Utilize a API v2.
 */

/**
 * @swagger
 * /rides/create:
 *   post:
 *     summary: Criar uma nova corrida com cálculo de rota e produtos disponíveis
 *     tags: [Corrida]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               pickup_location:
 *                 type: object
 *                 properties:
 *                   address:
 *                     type: string
 *                   coordinates:
 *                     type: object
 *                     properties:
 *                       latitude:
 *                         type: number
 *                       longitude:
 *                         type: number
 *               destination_location:
 *                 type: object
 *                 properties:
 *                   address:
 *                     type: string
 *                   coordinates:
 *                     type: object
 *                     properties:
 *                       latitude:
 *                         type: number
 *                       longitude:
 *                         type: number
 *     responses:
 *       410:
 *         description: Endpoint legado desativado. Utilize a API v2.
 */

/**
 * @swagger
 * /rides/update-product-payment/{id}:
 *   put:
 *     summary: Atualiza o produto e o método de pagamento de uma corrida
 *     tags: [Corrida]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da corrida
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               product:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   price:
 *                     type: number
 *                   description:
 *                     type: string
 *                   fare_breakdown:
 *                     type: object
 *                     properties:
 *                       valorBase:
 *                         type: number
 *                       valorKm:
 *                         type: number
 *                       custoFixo:
 *                         type: number
 *                       taxaIntermediacao:
 *                         type: number
 *                       subtotal:
 *                         type: number
 *                       valorTaxa:
 *                         type: number
 *               payment_method:
 *                 type: string
 *                 example: cartao
 *     responses:
 *       410:
 *         description: Endpoint legado desativado. Utilize a API v2.
 */

// Rota protegida para qualquer usuário autenticado
router.get("/protected", authMiddleware("passenger"), (req, res) => {
  res.json({ message: "Você acessou uma rota protegida!", user: req.user });
});

// Criar uma nova corrida (somente passageiro pode criar uma corrida)
router.post("/request", authMiddleware("passenger"), async (req, res) => {
  legacyRideRouteRemoved(res, "/api/rides/request");
});

// Listar corridas pendentes (somente motorista pode acessar)
router.get("/pending", authMiddleware("driver"), async (req, res) => {
  legacyRideRouteRemoved(res, "/api/rides/pending");
});

// Criar uma nova corrida com cálculo de rota e produtos disponíveis
router.post("/create", authMiddleware(), async (req, res) => {
  legacyRideRouteRemoved(res, "/api/rides/create");
});

// Atualizar produto e método de pagamento de uma corrida
router.put(
  "/update-product-payment/:id",
  authMiddleware(),
  async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    legacyRideRouteRemoved(res, "/api/rides/update-product-payment/:id");
  }
);

/**
 * @swagger
 * /rides/by-status:
 *   get:
 *     summary: Lista corridas filtrando por um ou mais status
 *     tags: [Corrida]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         required: true
 *         description: Status ou lista de status para filtrar
 *     responses:
 *       200:
 *         description: Lista de corridas filtradas
 *       400:
 *         description: Parâmetro de status ausente
 *       500:
 *         description: Erro ao buscar corridas
 */

// ...existing code...

// --- OUTRAS ROTAS ---

// Listar corridas por status (um ou mais)
router.get("/by-status", authMiddleware(), (req, res) => {
  let status = req.query.status;
  if (!status) {
    res.status(400).json({ message: "Parâmetro 'status' é obrigatório." });
    return;
  }
  if (!Array.isArray(status)) {
    status = [status];
  }
  Ride.find({ status: { $in: status } })
    .then((rides) => {
      res.json(rides);
    })
    .catch(() => {
      res.status(500).json({ message: "Erro ao buscar corridas" });
    });
});

/**
 * @swagger
 * /rides/delete-many:
 *   delete:
 *     summary: Exclui múltiplas corridas pelo array de IDs
 *     tags: [Corrida]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array de IDs das corridas a serem excluídas
 *     responses:
 *       200:
 *         description: Corridas excluídas com sucesso
 *       400:
 *         description: IDs não fornecidos ou inválidos
 *       500:
 *         description: Erro ao excluir corridas
 */

// --- OUTRAS ROTAS ---

// Excluir múltiplas corridas por array de IDs
router.delete(
  "/delete-many",
  authMiddleware(),
  async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ message: "Forneça um array de IDs para exclusão." });
    }
    try {
      const result = await Ride.deleteMany({ _id: { $in: ids } });
      res.json({
        message: "Corridas excluídas com sucesso",
        deletedCount: result.deletedCount,
      });
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir corridas" });
    }
  }
);

export default router;
