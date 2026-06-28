import { Request, Response } from "express";
import DriverDocumentService from "../services/driverDocumentService";
import User from "../models/User";
import { OnboardingService } from "../services/onboardingService";

const GENERIC_DOCUMENT_TYPE_MAP: Record<string, string> = {
  cnh: "CNH",
  crlv: "CRLV",
  rg: "RG",
  cpf: "CPF",
  selfie: "SELFIE",
  outro: "OUTRO",
  comprovante_residencia: "RESIDENCE_PROOF",
  residence_proof: "RESIDENCE_PROOF",
  antecedentes_criminais: "CRIMINAL_RECORD",
  criminal_record: "CRIMINAL_RECORD",
};

export class DriverDocumentController {
  static async uploadDriverOnboardingDocuments(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const files = (req as any).files as
        | {
            cnhFront?: any[];
            cnhBack?: any[];
            selfie?: any[];
          }
        | undefined;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
        });
      }

      const cnhFront = files?.cnhFront?.[0];
      const cnhBack = files?.cnhBack?.[0];
      const selfie = files?.selfie?.[0];

      if (!cnhFront || !cnhBack || !selfie) {
        return res.status(400).json({
          success: false,
          message: "Envie cnhFront, cnhBack e selfie",
        });
      }

      const [frontDocument, backDocument, selfieDocument] = await Promise.all([
        DriverDocumentService.upsertDriverDocumentWithFile({
          userId,
          type: "CNH",
          side: "FRONT",
          file: cnhFront,
        }),
        DriverDocumentService.upsertDriverDocumentWithFile({
          userId,
          type: "CNH",
          side: "BACK",
          file: cnhBack,
        }),
        DriverDocumentService.upsertDriverDocumentWithFile({
          userId,
          type: "SELFIE",
          file: selfie,
        }),
      ]);

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Usuário não encontrado",
        });
      }

      const onboardingStatus = await OnboardingService.buildDriverOnboarding(user);

      return res.status(200).json({
        success: true,
        message: "Documentos do onboarding salvos com sucesso",
        documents: {
          cnhFront: frontDocument,
          cnhBack: backDocument,
          selfie: selfieDocument,
        },
        onboardingStatus,
      });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Erro ao salvar documentos do onboarding",
        error: error.message,
      });
    }
  }

  /**
   * @openapi
   * /driver-documents:
   *   post:
   *     tags:
   *       - DriverDocuments
   *     summary: Criar documento de motorista
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               user:
   *                 type: string
   *               type:
   *                 type: string
   *               fileUrl:
   *                 type: string
   *               filename:
   *                 type: string
   *     responses:
   *       '201':
   *         description: Documento criado
   */
  static async createDocument(req: Request, res: Response) {
    try {
      const payload = req.body;
      if (!payload.user || !payload.type || !payload.fileUrl) {
        return res
          .status(400)
          .json({ success: false, message: "Campos obrigatórios ausentes" });
      }
      const doc = await DriverDocumentService.createDocument(payload);
      return res.status(201).json({ success: true, document: doc });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async uploadFile(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const file = (req as any).file;
      const rawType = String(req.body?.type || "")
        .trim()
        .toLowerCase();

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
        });
      }

      if (!file) {
        return res.status(422).json({
          statusCode: 422,
          error: "VALIDATION_ERROR",
          message: "Arquivo é obrigatório.",
        });
      }

      const normalizedType = GENERIC_DOCUMENT_TYPE_MAP[rawType];

      if (!normalizedType) {
        return res.status(422).json({
          statusCode: 422,
          error: "VALIDATION_ERROR",
          message: "Tipo de documento inválido.",
          details: {
            supportedTypes: [
              "comprovante_residencia",
              "antecedentes_criminais",
              "residence_proof",
              "criminal_record",
              "cnh",
              "crlv",
              "rg",
              "cpf",
              "selfie",
              "outro",
            ],
          },
        });
      }

      const document = await DriverDocumentService.upsertDriverDocumentWithFile({
        userId,
        type: normalizedType as any,
        file,
      });

      return res.status(200).json({
        success: true,
        message: "Documento enviado com sucesso.",
        document,
      });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: error.message || "Erro ao enviar documento.",
      });
    }
  }

  /**
   * @openapi
   * /driver-documents:
   *   get:
   *     tags:
   *       - DriverDocuments
   *     summary: Listar documentos (filtros: user, type, status)
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
   *         name: user
   *         schema:
   *           type: string
   *       - in: query
   *         name: type
   *         schema:
   *           type: string
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *     responses:
   *       '200':
   *         description: Lista de documentos
   */
  static async listDocuments(req: Request, res: Response) {
    try {
      const page = parseInt((req.query.page as string) || "1", 10);
      const limit = parseInt((req.query.limit as string) || "20", 10);
      const user = req.query.user as string;
      const type = req.query.type as string;
      const status = req.query.status as string;

      const filter: any = {};
      if (user) filter.user = user;
      if (type) filter.type = type;
      if (status) filter.status = status;
      const { documents, total } = await DriverDocumentService.listDocuments(
        filter,
        page,
        limit
      );
      return res
        .status(200)
        .json({ success: true, data: { documents, total, page, limit } });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * @openapi
   * /driver-documents/{id}:
   *   get:
   *     tags:
   *       - DriverDocuments
   *     summary: Buscar documento por ID
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       '200':
   *         description: Documento encontrado
   */
  static async getDocumentById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const doc = await DriverDocumentService.getById(id);
      if (!doc)
        return res
          .status(404)
          .json({ success: false, message: "Documento não encontrado" });
      return res.status(200).json({ success: true, document: doc });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * @openapi
   * /driver-documents/{id}:
   *   put:
   *     tags:
   *       - DriverDocuments
   *     summary: Atualizar documento
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
   *               filename:
   *                 type: string
   *               fileUrl:
   *                 type: string
   *               status:
   *                 type: string
   *               rejectionReason:
   *                 type: string
   *     responses:
   *       '200':
   *         description: Documento atualizado
   */
  static async updateDocument(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const update = req.body;
      const updated = await DriverDocumentService.updateDocument(id, update);
      if (!updated)
        return res
          .status(404)
          .json({ success: false, message: "Documento não encontrado" });
      return res.status(200).json({ success: true, document: updated });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * @openapi
   * /driver-documents/{id}:
   *   delete:
   *     tags:
   *       - DriverDocuments
   *     summary: Deletar documento
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       '200':
   *         description: Documento deletado
   */
  static async deleteDocument(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const deleted = await DriverDocumentService.deleteDocument(id);
      if (!deleted)
        return res
          .status(404)
          .json({ success: false, message: "Documento não encontrado" });
      return res.status(200).json({ success: true, document: deleted });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * @openapi
   * /driver-documents/{id}/approve:
   *   put:
   *     tags:
   *       - DriverDocuments
   *     summary: Aprovar documento
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       '200':
   *         description: Documento aprovado
   */
  static async approveDocument(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const updated = await DriverDocumentService.approveDocument(id);
      if (!updated)
        return res
          .status(404)
          .json({ success: false, message: "Documento não encontrado" });
      return res.status(200).json({ success: true, document: updated });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * @openapi
   * /driver-documents/{id}/reject:
   *   put:
   *     tags:
   *       - DriverDocuments
   *     summary: Rejeitar documento
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
   *               rejectionReason:
   *                 type: string
   *     responses:
   *       '200':
   *         description: Documento rejeitado
   */
  static async rejectDocument(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { rejectionReason } = req.body;
      const updated = await DriverDocumentService.rejectDocument(
        id,
        rejectionReason
      );
      if (!updated)
        return res
          .status(404)
          .json({ success: false, message: "Documento não encontrado" });
      return res.status(200).json({ success: true, document: updated });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

export default DriverDocumentController;
