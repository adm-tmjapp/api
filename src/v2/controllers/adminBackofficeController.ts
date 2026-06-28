import { Request, Response } from "express";
import {
  adminBackofficeService,
  AdminBackofficeError,
} from "../services/adminBackofficeService";

function handleError(res: Response, error: unknown, fallbackMessage: string) {
  if (error instanceof AdminBackofficeError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      code: error.code,
      details: error.details || {},
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: fallbackMessage,
    code: "INTERNAL_ERROR",
    details: {},
  });
}

export const adminBackofficeController = {
  async getDashboard(req: Request, res: Response) {
    try {
      const period = typeof req.query.period === "string" ? req.query.period : "monthly";
      const payload = await adminBackofficeService.getDashboard(period as any);
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error, "Erro ao carregar dashboard administrativo.");
    }
  },

  async listUsers(req: Request, res: Response) {
    try {
      const payload = await adminBackofficeService.listUsers({
        role: typeof req.query.role === "string" ? req.query.role : undefined,
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        page: Number(req.query.page || 1),
        limit: Number(req.query.limit || 20),
      });
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error, "Erro ao listar usuários.");
    }
  },

  async listPayments(req: Request, res: Response) {
    try {
      const payload = await adminBackofficeService.listPayments({
        page: Number(req.query.page || 1),
        limit: Number(req.query.limit || 20),
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        method: typeof req.query.method === "string" ? req.query.method : undefined,
      });
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error, "Erro ao listar pagamentos.");
    }
  },

  async listRides(req: Request, res: Response) {
    try {
      const rawStatus = req.query.status;
      const status = Array.isArray(rawStatus)
        ? rawStatus.filter((value): value is string => typeof value === "string")
        : typeof rawStatus === "string" && rawStatus
          ? [rawStatus]
          : undefined;

      const payload = await adminBackofficeService.listRides({
        page: Number(req.query.page || 1),
        limit: Number(req.query.limit || 20),
        status,
        paymentMethod:
          typeof req.query.paymentMethod === "string" ? req.query.paymentMethod : undefined,
        query: typeof req.query.q === "string" ? req.query.q : undefined,
        startDate: typeof req.query.startDate === "string" ? req.query.startDate : undefined,
        endDate: typeof req.query.endDate === "string" ? req.query.endDate : undefined,
      });
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error, "Erro ao listar corridas.");
    }
  },

  async cancelRide(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { reason } = req.body;
      const result = await adminBackofficeService.adminCancelRide(id, reason);
      res.status(200).json(result);
    } catch (error) {
      handleError(res, error, "Erro ao cancelar corrida.");
    }
  },

  async reassignDriver(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { driverId } = req.body;
      const result = await adminBackofficeService.adminReassignDriver(id, driverId);
      res.status(200).json(result);
    } catch (error) {
      handleError(res, error, "Erro ao reatribuir motorista.");
    }
  },

  async getRideDetails(req: Request, res: Response) {
    try {
      const payload = await adminBackofficeService.getRideDetails(req.params.id as string);
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error, "Erro ao carregar detalhes da corrida.");
    }
  },

  async search(req: Request, res: Response) {
    try {
      const query = typeof req.query.q === "string" ? req.query.q : "";
      const payload = await adminBackofficeService.search(query);
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error, "Erro ao executar busca administrativa.");
    }
  },

  async listDriverDocuments(req: Request, res: Response) {
    try {
      const payload = await adminBackofficeService.listDriverDocuments({
        page: Number(req.query.page || 1),
        limit: Number(req.query.limit || 20),
        user: typeof req.query.user === "string" ? req.query.user : undefined,
        type: typeof req.query.type === "string" ? req.query.type : undefined,
        status: typeof req.query.status === "string" ? req.query.status : undefined,
      });
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error, "Erro ao listar documentos.");
    }
  },

  async approveDriverDocument(req: Request, res: Response) {
    try {
      const payload = await adminBackofficeService.approveDriverDocument(
        req.params.id as string,
        req.user?.id,
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error, "Erro ao aprovar documento.");
    }
  },

  async rejectDriverDocument(req: Request, res: Response) {
    try {
      const payload = await adminBackofficeService.rejectDriverDocument(
        req.params.id as string,
        req.body?.rejectionReason,
        req.user?.id,
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error, "Erro ao rejeitar documento.");
    }
  },

  async batchApproveDriverDocuments(req: Request, res: Response) {
    try {
      const payload = await adminBackofficeService.batchApproveDriverDocuments(
        req.body?.ids || [],
        req.user?.id,
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error, "Erro ao aprovar documentos em lote.");
    }
  },

  async batchRejectDriverDocuments(req: Request, res: Response) {
    try {
      const payload = await adminBackofficeService.batchRejectDriverDocuments(
        req.body?.ids || [],
        req.body?.rejectionReason,
        req.user?.id,
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error, "Erro ao rejeitar documentos em lote.");
    }
  },

  async listVehicles(req: Request, res: Response) {
    try {
      const payload = await adminBackofficeService.listVehicles({
        page: Number(req.query.page || 1),
        limit: Number(req.query.limit || 20),
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        userId: typeof req.query.userId === "string" ? req.query.userId : undefined,
      });
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error, "Erro ao listar veículos.");
    }
  },

  async approveVehicle(req: Request, res: Response) {
    try {
      const payload = await adminBackofficeService.approveVehicle(
        req.params.id as string,
        req.user?.id,
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error, "Erro ao aprovar veículo.");
    }
  },

  async rejectVehicle(req: Request, res: Response) {
    try {
      const payload = await adminBackofficeService.rejectVehicle(
        req.params.id as string,
        req.user?.id,
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error, "Erro ao rejeitar veículo.");
    }
  },

  async batchApproveVehicles(req: Request, res: Response) {
    try {
      const payload = await adminBackofficeService.batchApproveVehicles(
        req.body?.ids || [],
        req.user?.id,
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error, "Erro ao aprovar veículos em lote.");
    }
  },

  async batchRejectVehicles(req: Request, res: Response) {
    try {
      const payload = await adminBackofficeService.batchRejectVehicles(
        req.body?.ids || [],
        req.user?.id,
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error, "Erro ao rejeitar veículos em lote.");
    }
  },

  async blockUser(req: Request, res: Response) {
    try {
      const payload = await adminBackofficeService.blockUser(req.params.id as string, req.user?.id);
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error, "Erro ao bloquear usuário.");
    }
  },

  async unblockUser(req: Request, res: Response) {
    try {
      const payload = await adminBackofficeService.unblockUser(req.params.id as string, req.user?.id);
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error, "Erro ao desbloquear usuário.");
    }
  },

  async resetDriverOnboarding(req: Request, res: Response) {
    try {
      const payload = await adminBackofficeService.resetDriverOnboarding(
        req.params.id as string,
        req.user?.id,
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error, "Erro ao resetar onboarding do motorista.");
    }
  },

  async getAuditLogs(req: Request, res: Response) {
    try {
      const payload = await adminBackofficeService.getAuditLogs({
        page: Number(req.query.page || 1),
        limit: Number(req.query.limit || 20),
        action: typeof req.query.action === "string" ? req.query.action : undefined,
        targetType:
          typeof req.query.targetType === "string" ? req.query.targetType : undefined,
      });
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error, "Erro ao listar logs de auditoria.");
    }
  },
};
