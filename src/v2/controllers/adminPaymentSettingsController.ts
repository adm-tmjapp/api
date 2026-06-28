import { Request, Response } from "express";
import {
  AdminPaymentSettingsError,
  adminPaymentSettingsService,
} from "../services/adminPaymentSettingsService";

function handleError(res: Response, error: unknown, fallbackMessage: string) {
  if (error instanceof AdminPaymentSettingsError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      code: error.code,
      details: error.details || {},
    });
    return;
  }

  const typed = error as Error;
  res.status(500).json({
    success: false,
    message: typed.message || fallbackMessage,
    code: "INTERNAL_ERROR",
    details: {},
  });
}

export const adminPaymentSettingsController = {
  async getCurrent(req: Request, res: Response) {
    try {
      const payload = await adminPaymentSettingsService.getCurrent({
        scopeType: typeof req.query.scopeType === "string" ? req.query.scopeType : undefined,
        scopeId: typeof req.query.scopeId === "string" ? req.query.scopeId : undefined,
      });
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error, "Erro ao consultar configuração de pagamentos.");
    }
  },

  async upsert(req: Request, res: Response) {
    try {
      const payload = await adminPaymentSettingsService.upsert(
        {
          provider: req.body?.provider,
          enabledMethods: req.body?.enabledMethods,
          defaultMethod: req.body?.defaultMethod,
          allowSavedCard: !!req.body?.allowSavedCard,
          scopeType: req.body?.scopeType,
          scopeId: req.body?.scopeId,
        },
        req.user?.id,
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error, "Erro ao atualizar configuração de pagamentos.");
    }
  },

  async list(req: Request, res: Response) {
    try {
      const payload = await adminPaymentSettingsService.list();
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error, "Erro ao listar configurações de pagamentos.");
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const payload = await adminPaymentSettingsService.delete(req.params.id as string, req.user?.id);
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error, "Erro ao remover override de pagamentos.");
    }
  },

  async listAuditLogs(_req: Request, res: Response) {
    try {
      const payload = await adminPaymentSettingsService.listAuditLogs();
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error, "Erro ao listar auditoria de pagamentos.");
    }
  },
};
