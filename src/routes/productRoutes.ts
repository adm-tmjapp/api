import express, { Request, Response, NextFunction } from "express";
import { body, param, validationResult } from "express-validator";
import Product from "../models/Product";
import authMiddleware from "../middlewares/authMiddleware";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Produtos
 *   description: Gerenciamento de produtos
 */

/**
 * @swagger
 * /produtos:
 *   post:
 *     summary: Cria um novo produto
 *     tags: [Produtos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nome do produto
 *               icon:
 *                 type: string
 *                 description: URL do ícone do produto
 *               taxaId:
 *                 type: string
 *                 description: ID da tarifa associada
 *     responses:
 *       201:
 *         description: Produto criado com sucesso
 *       400:
 *         description: Erro de validação
 *       401:
 *         description: Não autorizado
 */

// Middleware para validação de entrada
function validateInputs(validations: any[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return; // Ensure the function returns void
    }

    next();
  };
}

// Criar um novo produto
router.post(
  "/",
  authMiddleware("admin"),
  validateInputs([
    body("name").notEmpty().withMessage("O nome é obrigatório."),
  ]),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, icon, taxaId } = req.body;
      const product = new Product({ name, icon, taxaId });
      await product.save();
      res.status(201).json(product);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /produtos:
 *   get:
 *     summary: Lista todos os produtos
 *     tags: [Produtos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de produtos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Produto'
 *       401:
 *         description: Não autorizado
 */

// Listar todos os produtos
router.get(
  "/",
  authMiddleware("admin"),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const products = await Product.find();
      res.json(products);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /produtos/{id}:
 *   get:
 *     summary: Obtém um produto pelo ID
 *     tags: [Produtos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do produto
 *     responses:
 *       200:
 *         description: Detalhes do produto
 *       404:
 *         description: Produto não encontrado
 *       401:
 *         description: Não autorizado
 */

// Obter um produto por ID
router.get(
  "/:id",
  authMiddleware("admin"),
  validateInputs([param("id").isMongoId().withMessage("ID inválido.")]),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const product = await Product.findById(id);
      if (!product) {
        res.status(404).json({ error: "Produto não encontrado." });
        return;
      }
      res.json(product);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /produtos/{id}:
 *   put:
 *     summary: Atualiza um produto pelo ID
 *     tags: [Produtos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do produto
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nome do produto
 *               icon:
 *                 type: string
 *                 description: URL do ícone do produto
 *               taxaId:
 *                 type: string
 *                 description: ID da tarifa associada
 *     responses:
 *       200:
 *         description: Produto atualizado com sucesso
 *       404:
 *         description: Produto não encontrado
 *       401:
 *         description: Não autorizado
 */

// Atualizar um produto
router.put(
  "/:id",
  authMiddleware("admin"),
  validateInputs([
    param("id").isMongoId().withMessage("ID inválido."),
    body("name")
      .optional()
      .notEmpty()
      .withMessage("O nome não pode ser vazio."),
  ]),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { name, icon, taxaId } = req.body;
      const product = await Product.findByIdAndUpdate(
        id,
        { name, icon, taxaId },
        { new: true }
      );
      if (!product) {
        res.status(404).json({ error: "Produto não encontrado." });
        return;
      }
      res.json(product);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /produtos/{id}:
 *   delete:
 *     summary: Exclui um produto pelo ID
 *     tags: [Produtos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do produto
 *     responses:
 *       204:
 *         description: Produto excluído com sucesso
 *       404:
 *         description: Produto não encontrado
 *       401:
 *         description: Não autorizado
 */

// Excluir um produto
router.delete(
  "/:id",
  authMiddleware("admin"),
  validateInputs([param("id").isMongoId().withMessage("ID inválido.")]),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const product = await Product.findByIdAndDelete(id);
      if (!product) {
        res.status(404).json({ error: "Produto não encontrado." });
        return;
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * components:
 *   schemas:
 *     Produto:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: ID do produto
 *         name:
 *           type: string
 *           description: Nome do produto
 *         icon:
 *           type: string
 *           description: URL do ícone do produto
 *         taxaId:
 *           type: string
 *           description: ID da tarifa associada
 */

export default router;
