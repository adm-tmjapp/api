import { Request, Response } from "express";
import VehicleService from "../services/vehicleService";
import { IVehicle } from "../models/Vehicle";
import User from "../models/User";
import { OnboardingService } from "../services/onboardingService";

export class VehicleController {
  static async saveOnboardingVehicle(req: Request, res: Response) {
    try {
      const authenticatedUserId = req.user?.id;
      const {
        userId,
        vehicleType,
        manufacturer,
        modelName,
        year,
        color,
        vehiclePlate,
        usage,
        renavam,
      } = req.body;

      if (!authenticatedUserId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
        });
      }

      if (
        !vehicleType ||
        !manufacturer ||
        !modelName ||
        !year ||
        !color ||
        !vehiclePlate ||
        !usage
      ) {
        return res.status(400).json({
          success: false,
          message: "Campos obrigatórios ausentes",
        });
      }

      if (!["carro", "moto"].includes(vehicleType)) {
        return res.status(400).json({
          success: false,
          message: "vehicleType deve ser carro ou moto",
        });
      }

      if (!["ENTREGAS", "PASSAGEIROS", "AMBOS"].includes(usage)) {
        return res.status(400).json({
          success: false,
          message: "usage deve ser ENTREGAS, PASSAGEIROS ou AMBOS",
        });
      }

      if (userId && userId !== authenticatedUserId) {
        return res.status(403).json({
          success: false,
          message: "Acesso não autorizado",
        });
      }

      const conflict = await VehicleService.findConflictForOnboarding({
        userId: authenticatedUserId,
        vehiclePlate: vehiclePlate.trim().toUpperCase(),
        renavam: renavam || null,
      });

      if (conflict) {
        return res.status(409).json({
          success: false,
          message: "Veículo já cadastrado para outro usuário",
        });
      }

      const vehicle = await VehicleService.upsertOnboardingVehicle({
        userId: authenticatedUserId,
        vehicleType,
        manufacturer,
        modelName,
        year,
        color,
        vehiclePlate,
        usage,
        renavam: renavam || null,
      });

      const user = await User.findById(authenticatedUserId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Usuário não encontrado",
        });
      }

      const onboardingStatus = await OnboardingService.buildDriverOnboarding(user);

      return res.status(200).json({
        success: true,
        message: "Veículo salvo com sucesso",
        vehicle,
        onboardingStatus,
      });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Erro ao salvar veículo do onboarding",
        error: error.message,
      });
    }
  }

  /**
   * @openapi
   * /vehicles:
   *   post:
   *     tags:
   *       - Vehicles
   *     summary: Criar um novo veículo
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               userId:
   *                 type: string
   *               vehicleType:
   *                 type: string
   *               manufacturer:
   *                 type: string
   *               modelName:
   *                 type: string
   *               color:
   *                 type: string
   *               vehiclePlate:
   *                 type: string
   *               renavam:
   *                 type: string
   *               photo:
   *                 type: string
   *               documents:
   *                 type: array
   *                 items:
   *                   type: string
   *             required: [userId, vehicleType, manufacturer, modelName, color, vehiclePlate, renavam]
   *     responses:
   *       '201':
   *         description: Veículo criado
   *       '400':
   *         description: Campos obrigatórios ausentes
   *       '409':
   *         description: Veículo já cadastrado
   *       '500':
   *         description: Erro do servidor
   */
  // Criar um veículo
  static async createVehicle(req: Request, res: Response) {
    try {
      const {
        userId,
        vehicleType,
        manufacturer,
        modelName,
        color,
        vehiclePlate,
        renavam,
        photo,
        documents,
      } = req.body;

      if (
        !userId ||
        !vehicleType ||
        !manufacturer ||
        !modelName ||
        !color ||
        !vehiclePlate ||
        !renavam
      ) {
        return res.status(400).json({
          success: false,
          message: "Campos obrigatórios ausentes",
        });
      }

      // Verifica renavam/plate duplicados via service
      const existing = await VehicleService.findByRenavamOrPlate(
        renavam,
        vehiclePlate
      );
      if (existing) {
        return res
          .status(409)
          .json({ success: false, message: "Veículo já cadastrado" });
      }

      const vehicle = await VehicleService.createVehicle({
        userId,
        vehicleType,
        manufacturer,
        modelName,
        color,
        vehiclePlate,
        renavam,
        photo,
        documents,
      } as any);

      return res.status(201).json({ success: true, vehicle });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Erro ao criar veículo",
        error: error.message,
      });
    }
  }

  /**
   * @openapi
   * /vehicles:
   *   get:
   *     tags:
   *       - Vehicles
   *     summary: Listar veículos com filtros e paginação
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *       - in: query
   *         name: userId
   *         schema:
   *           type: string
   *     responses:
   *       '200':
   *         description: Lista de veículos
   *       '500':
   *         description: Erro do servidor
   */
  // Listar veículos com filtros e paginação
  static async listVehicles(req: Request, res: Response) {
    try {
      const page = parseInt((req.query.page as string) || "1", 10);
      const limit = parseInt((req.query.limit as string) || "20", 10);
      const status = req.query.status as string;
      const userId = req.query.userId as string;

      const filter: any = {};
      if (status) filter.status = status;
      if (userId) filter.userId = userId;

      const { vehicles, total } = await VehicleService.listVehicles(
        filter,
        page,
        limit
      );

      return res.status(200).json({
        success: true,
        data: { vehicles, total, page, limit },
      });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Erro ao listar veículos",
        error: error.message,
      });
    }
  }

  /**
   * @openapi
   * /vehicles/{id}:
   *   get:
   *     tags:
   *       - Vehicles
   *     summary: Buscar veículo por ID
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       '200':
   *         description: Veículo encontrado
   *       '404':
   *         description: Veículo não encontrado
   *       '500':
   *         description: Erro do servidor
   */
  // Buscar veículo por ID
  static async getVehicleById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const vehicle = await VehicleService.getVehicleById(id);
      if (!vehicle) {
        return res
          .status(404)
          .json({ success: false, message: "Veículo não encontrado" });
      }
      return res.status(200).json({ success: true, vehicle });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar veículo",
        error: error.message,
      });
    }
  }

  /**
   * @openapi
   * /vehicles/{id}:
   *   put:
   *     tags:
   *       - Vehicles
   *     summary: Atualizar veículo
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               vehicleType:
   *                 type: string
   *               manufacturer:
   *                 type: string
   *               modelName:
   *                 type: string
   *               color:
   *                 type: string
   *               vehiclePlate:
   *                 type: string
   *               renavam:
   *                 type: string
   *               status:
   *                 type: string
   *               photo:
   *                 type: string
   *               documents:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       '200':
   *         description: Veículo atualizado
   *       '404':
   *         description: Veículo não encontrado
   *       '500':
   *         description: Erro do servidor
   */
  // Atualizar veículo
  static async updateVehicle(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const updateFields: Partial<IVehicle> = {};
      const allowed = [
        "vehicleType",
        "manufacturer",
        "modelName",
        "color",
        "vehiclePlate",
        "renavam",
        "status",
      ];
      for (const key of allowed) {
        if (req.body[key] !== undefined) {
          // @ts-ignore
          updateFields[key] = req.body[key];
        }
      }

      if (req.body.photo) updateFields.photo = req.body.photo as any;
      if (req.body.documents)
        updateFields.documents = req.body.documents as any;

      const updated = await VehicleService.updateVehicle(
        id,
        updateFields as any
      );

      if (!updated) {
        return res
          .status(404)
          .json({ success: false, message: "Veículo não encontrado" });
      }
      return res.status(200).json({ success: true, vehicle: updated });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Erro ao atualizar veículo",
        error: error.message,
      });
    }
  }

  /**
   * @openapi
   * /vehicles/{id}:
   *   delete:
   *     tags:
   *       - Vehicles
   *     summary: Deletar veículo
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       '200':
   *         description: Veículo deletado
   *       '404':
   *         description: Veículo não encontrado
   *       '500':
   *         description: Erro do servidor
   */
  // Deletar veículo
  static async deleteVehicle(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const deleted = await VehicleService.deleteVehicle(id);
      if (!deleted) {
        return res
          .status(404)
          .json({ success: false, message: "Veículo não encontrado" });
      }
      return res.status(200).json({ success: true, vehicle: deleted });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Erro ao deletar veículo",
        error: error.message,
      });
    }
  }

  /**
   * @openapi
   * /vehicles/{id}/approve:
   *   put:
   *     tags:
   *       - Vehicles
   *     summary: Aprovar veículo
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               approvedBy:
   *                 type: string
   *     responses:
   *       '200':
   *         description: Veículo aprovado
   *       '404':
   *         description: Veículo não encontrado
   *       '500':
   *         description: Erro do servidor
   */
  // Aprovar veículo
  static async approveVehicle(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { approvedBy } = req.body;
      const updated = await VehicleService.approveVehicle(id, approvedBy);
      if (!updated) {
        return res
          .status(404)
          .json({ success: false, message: "Veículo não encontrado" });
      }
      return res.status(200).json({ success: true, vehicle: updated });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Erro ao aprovar veículo",
        error: error.message,
      });
    }
  }

  /**
   * @openapi
   * /vehicles/{id}/reject:
   *   put:
   *     tags:
   *       - Vehicles
   *     summary: Rejeitar veículo
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       '200':
   *         description: Veículo rejeitado
   *       '404':
   *         description: Veículo não encontrado
   *       '500':
   *         description: Erro do servidor
   */
  // Rejeitar veículo
  static async rejectVehicle(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const updated = await VehicleService.rejectVehicle(id);
      if (!updated) {
        return res
          .status(404)
          .json({ success: false, message: "Veículo não encontrado" });
      }
      return res.status(200).json({ success: true, vehicle: updated });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Erro ao rejeitar veículo",
        error: error.message,
      });
    }
  }

  /**
   * @openapi
   * /vehicles/{id}/documents:
   *   post:
   *     tags:
   *       - Vehicles
   *     summary: Adicionar documento ao veículo
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               documentId:
   *                 type: string
   *             required: [documentId]
   *     responses:
   *       '200':
   *         description: Documento adicionado
   *       '400':
   *         description: documentId é obrigatório
   *       '404':
   *         description: Veículo não encontrado
   *       '500':
   *         description: Erro do servidor
   */
  // Adicionar documento
  static async addDocument(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { documentId } = req.body;
      if (!documentId) {
        return res
          .status(400)
          .json({ success: false, message: "documentId é obrigatório" });
      }
      const vehicle = await VehicleService.addDocument(id, documentId);
      if (!vehicle)
        return res
          .status(404)
          .json({ success: false, message: "Veículo não encontrado" });
      return res.status(200).json({ success: true, vehicle });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Erro ao adicionar documento",
        error: error.message,
      });
    }
  }

  /**
   * @openapi
   * /vehicles/{id}/documents:
   *   delete:
   *     tags:
   *       - Vehicles
   *     summary: Remover documento do veículo
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               documentId:
   *                 type: string
   *             required: [documentId]
   *     responses:
   *       '200':
   *         description: Documento removido
   *       '400':
   *         description: documentId é obrigatório
   *       '404':
   *         description: Veículo não encontrado
   *       '500':
   *         description: Erro do servidor
   */
  // Remover documento
  static async removeDocument(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { documentId } = req.body;
      if (!documentId) {
        return res
          .status(400)
          .json({ success: false, message: "documentId é obrigatório" });
      }
      const vehicle = await VehicleService.removeDocument(id, documentId);
      if (!vehicle)
        return res
          .status(404)
          .json({ success: false, message: "Veículo não encontrado" });
      return res.status(200).json({ success: true, vehicle });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Erro ao remover documento",
        error: error.message,
      });
    }
  }

  /**
   * @openapi
   * /vehicles/{id}/photo:
   *   put:
   *     tags:
   *       - Vehicles
   *     summary: Atualizar foto do veículo
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               photoId:
   *                 type: string
   *             required: [photoId]
   *     responses:
   *       '200':
   *         description: Foto atualizada
   *       '400':
   *         description: photoId é obrigatório
   *       '404':
   *         description: Veículo não encontrado
   *       '500':
   *         description: Erro do servidor
   */
  // Atualizar foto do veículo
  static async updatePhoto(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { photoId } = req.body;
      if (!photoId)
        return res
          .status(400)
          .json({ success: false, message: "photoId é obrigatório" });
      const updated = await VehicleService.updatePhoto(id, photoId);
      if (!updated)
        return res
          .status(404)
          .json({ success: false, message: "Veículo não encontrado" });
      return res.status(200).json({ success: true, vehicle: updated });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Erro ao atualizar foto",
        error: error.message,
      });
    }
  }
}

export default VehicleController;
