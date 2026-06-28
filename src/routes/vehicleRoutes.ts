import { NextFunction, Router, Request, Response } from "express";
import VehicleController from "../controllers/vehicleController";

const router = Router();

const asyncHandler = (
  fn: (req: Request, res: Response, next?: NextFunction) => any
) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await fn(req, res, next);
    } catch (err) {
      next(err);
    }
  };
};

router.post("/vehicles", asyncHandler(VehicleController.createVehicle));
router.get("/vehicles", asyncHandler(VehicleController.listVehicles));
router.get("/vehicles/:id", asyncHandler(VehicleController.getVehicleById));
router.put("/vehicles/:id", asyncHandler(VehicleController.updateVehicle));
router.delete("/vehicles/:id", asyncHandler(VehicleController.deleteVehicle));
router.put(
  "/vehicles/:id/approve",
  asyncHandler(VehicleController.approveVehicle)
);
router.put(
  "/vehicles/:id/reject",
  asyncHandler(VehicleController.rejectVehicle)
);
router.post(
  "/vehicles/:id/documents",
  asyncHandler(VehicleController.addDocument)
);
router.delete(
  "/vehicles/:id/documents",
  asyncHandler(VehicleController.removeDocument)
);
router.put("/vehicles/:id/photo", asyncHandler(VehicleController.updatePhoto));

// export default router;
// import express, { Request, Response, Router, NextFunction } from "express";
// import path from "path";
// import fs from "fs";
// import multer from "multer";
// import authMiddleware from "../middlewares/authMiddleware";
// import Vehicle from "../models/Vehicle";
// import DriverDocument from "../models/DriverDocument";
// import mongoose from "mongoose";
// import AWS from "aws-sdk";
// import { body, query, param, validationResult } from "express-validator";
// import winston from "winston";

// const router = express.Router();
// const upload = multer({
//   dest: path.join(__dirname, "../../uploads/vehicles"),
// });

// // Declaração de tipo personalizada para corrigir o namespace Express.Multer.File
// declare global {
//   namespace Express {
//     interface Request {
//       file?: Express.Multer.File;
//     }
//   }
// }

// // Declaração de tipo personalizada para req.user
// declare global {
//   namespace Express {
//     interface Request {
//       user?: {
//         id: string;
//         role: "passenger" | "driver" | "admin";
//       };
//     }
//   }
// }

// // Interface para documentos
// interface Document {
//   filename: string;
//   originalname: string;
//   path: string;
// }

// // Simulated database for vehicles
// const vehicles: Record<string, any[]> = {};

// Configuração do S3
// const s3 = new AWS.S3({
//   accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   region: process.env.AWS_REGION,
// });
// const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

// /**
//  * @swagger
//  * tags:
//  *   - name: Veiculo
//  *     description: Operações relacionadas a veículos
//  *
//  * /vehicles:
//  *   post:
//  *     tags:
//  *       - Veiculo
//  *     summary: Cria um novo veículo para um usuário.
//  *     security:
//  *       - bearerAuth: []
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             properties:
//  *               userId:
//  *                 type: string
//  *               vehicleType:
//  *                 type: string
//  *               manufacturer:
//  *                 type: string
//  *               model:
//  *                 type: string
//  *               color:
//  *                 type: string
//  *               vehiclePlate:
//  *                 type: string
//  *     responses:
//  *       201:
//  *         description: Veículo criado com sucesso.
//  *       400:
//  *         description: Erro de validação.
//  *
//  * /vehicles/all:
//  *   get:
//  *     tags:
//  *       - Veiculo
//  *     summary: Retorna todos os veículos de um usuário.
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: query
//  *         name: userId
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: ID do usuário.
//  *     responses:
//  *       200:
//  *         description: Lista de veículos.
//  *       400:
//  *         description: Erro de validação.
//  *
//  * /vehicles/{vehicleId}:
//  *   get:
//  *     tags:
//  *       - Veiculo
//  *     summary: Retorna um veículo específico de um usuário.
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: query
//  *         name: userId
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: ID do usuário.
//  *       - in: path
//  *         name: vehicleId
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: ID do veículo.
//  *     responses:
//  *       200:
//  *         description: Dados do veículo.
//  *       404:
//  *         description: Veículo não encontrado.
//  *
//  *   put:
//  *     tags:
//  *       - Veiculo
//  *     summary: Atualiza um veículo específico de um usuário.
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: query
//  *         name: userId
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: ID do usuário.
//  *       - in: path
//  *         name: vehicleId
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: ID do veículo.
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             properties:
//  *               vehicleType:
//  *                 type: string
//  *               manufacturer:
//  *                 type: string
//  *               model:
//  *                 type: string
//  *               color:
//  *                 type: string
//  *               vehiclePlate:
//  *                 type: string
//  *     responses:
//  *       200:
//  *         description: Veículo atualizado com sucesso.
//  *       404:
//  *         description: Veículo não encontrado.
//  *
//  *   delete:
//  *     tags:
//  *       - Veiculo
//  *     summary: Exclui um veículo específico de um usuário.
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: query
//  *         name: userId
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: ID do usuário.
//  *       - in: path
//  *         name: vehicleId
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: ID do veículo.
//  *     responses:
//  *       204:
//  *         description: Veículo excluído com sucesso.
//  *       404:
//  *         description: Veículo não encontrado.
//  *
//  * /vehicles/{vehicleId}/documents:
//  *   post:
//  *     tags:
//  *       - Veiculo
//  *     summary: Faz upload de um documento para um veículo.
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: query
//  *         name: userId
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: ID do usuário.
//  *       - in: path
//  *         name: vehicleId
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: ID do veículo.
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         multipart/form-data:
//  *           schema:
//  *             type: object
//  *             properties:
//  *               document:
//  *                 type: string
//  *                 format: binary
//  *     responses:
//  *       201:
//  *         description: Documento enviado com sucesso.
//  *       400:
//  *         description: Nenhum arquivo enviado.
//  *
//  *   get:
//  *     tags:
//  *       - Veiculo
//  *     summary: Retorna todos os documentos de um veículo.
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: query
//  *         name: userId
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: ID do usuário.
//  *       - in: path
//  *         name: vehicleId
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: ID do veículo.
//  *     responses:
//  *       200:
//  *         description: Lista de documentos.
//  *       404:
//  *         description: Veículo não encontrado.
//  *
//  * /vehicles/{vehicleId}/documents/{filename}:
//  *   get:
//  *     tags:
//  *       - Veiculo
//  *     summary: Faz download de um documento específico de um veículo.
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: query
//  *         name: userId
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: ID do usuário.
//  *       - in: path
//  *         name: vehicleId
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: ID do veículo.
//  *       - in: path
//  *         name: filename
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: Nome do arquivo.
//  *     responses:
//  *       200:
//  *         description: Documento encontrado e enviado.
//  *       404:
//  *         description: Documento não encontrado.
//  *
//  * /vehicles/{vehicleId}/status:
//  *   put:
//  *     tags:
//  *       - Veiculo
//  *     summary: Aprova ou reprova um documento de um veículo.
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: vehicleId
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: ID do veículo.
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             properties:
//  *               status:
//  *                 type: string
//  *                 enum: ["Aprovado", "Reprovado"]
//  *                 description: Novo status do documento.
//  *     responses:
//  *       200:
//  *         description: Status atualizado com sucesso.
//  *       400:
//  *         description: Erro de validação.
//  *       401:
//  *         description: Usuário não autenticado.
//  *       404:
//  *         description: Veículo não encontrado.
//  */

// // Função utilitária para verificar se o bucket do S3 está configurado
// function ensureBucketConfigured() {
//   if (!BUCKET_NAME) {
//     throw new Error(
//       "O nome do bucket do S3 não está definido. Verifique as variáveis de ambiente."
//     );
//   }
// }

// // Função utilitária para criar parâmetros do S3
// function createS3Params(
//   vehicleId: string,
//   filename: string,
//   fileBody?: fs.ReadStream,
//   contentType?: string
// ) {
//   ensureBucketConfigured();
//   const params: AWS.S3.PutObjectRequest | AWS.S3.GetObjectRequest = {
//     Bucket: BUCKET_NAME!,
//     Key: `${vehicleId}/${filename}`,
//     ...(fileBody && { Body: fileBody }),
//     ...(contentType && { ContentType: contentType }),
//   };
//   return params;
// }

// // Configuração do logger
// const logger = winston.createLogger({
//   level: "info",
//   format: winston.format.json(),
//   transports: [
//     new winston.transports.Console(),
//     new winston.transports.File({ filename: "error.log", level: "error" }),
//   ],
// });

// // Middleware para validação de entrada
// function validateInputs(validations: any[]): express.RequestHandler {
//   return async (req, res, next) => {
//     try {
//       await Promise.all(validations.map((validation) => validation.run(req)));

//       const errors = validationResult(req);
//       if (!errors.isEmpty()) {
//         res.status(400).json({ errors: errors.array() });
//         return;
//       }

//       next();
//     } catch (error) {
//       next(error);
//     }
//   };
// }

// // Create a new vehicle for a user
// router.post(
//   "/",
//   authMiddleware(),
//   async (req: Request, res: Response, next: NextFunction): Promise<any> => {
//     try {
//       const { userId, vehicleType, manufacturer, model, color, vehiclePlate } =
//         req.body;

//       if (!userId) {
//         return res
//           .status(400)
//           .json({ error: "O campo 'userId' é obrigatório." });
//       }

//       const newVehicle = new Vehicle({
//         userId,
//         vehicleType,
//         manufacturer,
//         model,
//         color,
//         vehiclePlate,
//       });

//       await newVehicle.save();
//       res.status(201).json(newVehicle);
//     } catch (error) {
//       next(error);
//     }
//   }
// );

// // Get all vehicles for a user
// router.get(
//   "/all",
//   authMiddleware(),
//   validateInputs([query("userId").isMongoId().withMessage("Invalid user ID")]),
//   async (req: Request, res: Response, next: NextFunction): Promise<any> => {
//     try {
//       const { userId } = req.query;
//       const vehicles = await Vehicle.find({ userId });
//       res.json(vehicles);
//     } catch (error) {
//       next(error);
//     }
//   }
// );

// // Get a specific vehicle for a user
// router.get(
//   "/:vehicleId",
//   authMiddleware(),
//   async (req: Request, res: Response, next: NextFunction): Promise<any> => {
//     try {
//       const { userId } = req.query;
//       const { vehicleId } = req.params;

//       if (!userId) {
//         return res
//           .status(400)
//           .json({ error: "O campo 'userId' é obrigatório." });
//       }

//       const vehicle = await Vehicle.findOne({ _id: vehicleId, userId });

//       if (!vehicle) {
//         return res.status(404).json({ error: "Vehicle not found" });
//       }

//       res.json(vehicle);
//     } catch (error) {
//       next(error);
//     }
//   }
// );

// // Update a vehicle for a user
// router.put(
//   "/:vehicleId",
//   authMiddleware(),
//   async (req: Request, res: Response, next: NextFunction): Promise<any> => {
//     try {
//       const userId = req.query.userId as string; // Garantir que userId seja uma string
//       const vehicleId = req.params.vehicleId as string; // Garantir que vehicleId seja uma string
//       const { vehicleType, manufacturer, model, color, vehiclePlate } =
//         req.body;

//       if (!userId) {
//         return res
//           .status(400)
//           .json({ error: "O campo 'userId' é obrigatório." });
//       }

//       const updatedVehicle = await Vehicle.findOneAndUpdate(
//         { _id: vehicleId, userId },
//         { vehicleType, manufacturer, model, color, vehiclePlate },
//         { new: true }
//       );

//       if (!updatedVehicle) {
//         return res.status(404).json({ error: "Vehicle not found" });
//       }

//       res.json(updatedVehicle);
//     } catch (error) {
//       next(error);
//     }
//   }
// );

// // Delete a vehicle for a user
// router.delete(
//   "/:vehicleId",
//   authMiddleware(),
//   async (req: Request, res: Response, next: NextFunction): Promise<any> => {
//     try {
//       const userId = req.query.userId as string; // Garantir que userId seja uma string
//       const vehicleId = req.params.vehicleId as string; // Garantir que vehicleId seja uma string

//       if (!userId) {
//         return res
//           .status(400)
//           .json({ error: "O campo 'userId' é obrigatório." });
//       }

//       const deletedVehicle = await Vehicle.findOneAndDelete({
//         _id: vehicleId,
//         userId,
//       });

//       if (!deletedVehicle) {
//         return res.status(404).json({ error: "Vehicle not found" });
//       }

//       res.status(204).send();
//     } catch (error) {
//       next(error);
//     }
//   }
// );

// // Upload a document for a vehicle
// router.post(
//   "/:vehicleId/documents",
//   authMiddleware(),
//   upload.single("document"),
//   validateInputs([
//     param("vehicleId").isMongoId().withMessage("Invalid vehicle ID"),
//   ]),
//   async (req: Request, res: Response, next: NextFunction): Promise<any> => {
//     try {
//       const { vehicleId } = req.params;
//       const file = req.file;

//       if (!file) {
//         return res.status(400).json({ error: "No file uploaded" });
//       }

//       const s3Params = createS3Params(
//         vehicleId,
//         file.originalname,
//         fs.createReadStream(file.path),
//         file.mimetype
//       );
//       const uploadResult = await s3.upload(s3Params).promise();

//       // Remover arquivo temporário
//       fs.unlink(file.path, (err) => {
//         if (err) {
//           logger.error(`Erro ao remover arquivo temporário: ${err.message}`);
//         }
//       });
//       const vehicle = await Vehicle.findById(vehicleId);

//       if (!vehicle) {
//         return res.status(404).json({ error: "Vehicle not found" });
//       }

//       const doc = await DriverDocument.create({
//         user: vehicle.userId,
//         type: (req.body.type as any) || "OUTRO",
//         filename: file.originalname,
//         fileUrl: uploadResult.Location,
//         status: "PENDING",
//       });

//       vehicle.documents = vehicle.documents || [];
//       vehicle.documents.push(doc._id as mongoose.Types.ObjectId);
//       await vehicle.save();

//       res.status(201).json({
//         message: "Document uploaded successfully",
//         document: doc,
//       });
//     } catch (error) {
//       next(error);
//     }
//   }
// );

// // Get all documents for a vehicle
// router.get(
//   "/:vehicleId/documents",
//   authMiddleware(),
//   async (req: Request, res: Response, next: NextFunction): Promise<any> => {
//     try {
//       const { vehicleId } = req.params;

//       const vehicle = await Vehicle.findById(vehicleId).populate("documents");

//       if (!vehicle) {
//         return res.status(404).json({ error: "Vehicle not found" });
//       }

//       res.json(vehicle.documents || []);
//     } catch (error) {
//       next(error);
//     }
//   }
// );

// // Download a specific document for a vehicle
// router.get(
//   "/:vehicleId/documents/:filename",
//   authMiddleware(),
//   async (req: Request, res: Response, next: NextFunction): Promise<any> => {
//     try {
//       const { vehicleId, filename } = req.params;

//       const vehicle = await Vehicle.findById(vehicleId).populate("documents");

//       if (!vehicle) {
//         return res.status(404).json({ error: "Vehicle not found" });
//       }

//       const document = (vehicle.documents as any[]).find(
//         (doc) => doc.filename === filename
//       );

//       if (!document) {
//         return res.status(404).json({ error: "Document not found" });
//       }

//       const s3Params = {
//         Bucket: BUCKET_NAME,
//         Key: `${vehicleId}/${filename}`,
//         Expires: 60 * 5, // URL válida por 5 minutos
//       };

//       const signedUrl = s3.getSignedUrl("getObject", s3Params);

//       res.json({ url: signedUrl });
//     } catch (error) {
//       next(error);
//     }
//   }
// );

// // Aprovar ou reprovar documento do veículo
// router.put(
//   "/:approverId/:vehicleId/status",
//   authMiddleware(),
//   validateInputs([
//     param("approverId").isMongoId().withMessage("Invalid approver ID"),
//     param("vehicleId").isMongoId().withMessage("Invalid vehicle ID"),
//     body("status")
//       .isIn(["Aprovado", "Reprovado"])
//       .withMessage("Status inválido. Use 'Aprovado' ou 'Reprovado'."),
//   ]),
//   async (req: Request, res: Response, next: NextFunction): Promise<any> => {
//     try {
//       const { approverId, vehicleId } = req.params;
//       const { status } = req.body;

//       const updatedVehicle = await Vehicle.findByIdAndUpdate(
//         vehicleId,
//         {
//           $set: {
//             status,
//             approvedBy: approverId,
//             approvedAt: new Date(),
//           },
//         },
//         { new: true }
//       );

//       if (!updatedVehicle) {
//         return res.status(404).json({ error: "Vehicle not found" });
//       }

//       res.json({
//         message: `Status atualizado para ${status}.`,
//         vehicle: updatedVehicle,
//       });
//     } catch (error) {
//       next(error);
//     }
//   }
// );

// // Middleware global para tratamento de erros
// router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
//   logger.error(err.message);
//   res.status(500).json({ error: "Internal Server Error" });
// });

export default router;
