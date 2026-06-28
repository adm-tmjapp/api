import { Request, Response } from "express";
import {
  driverWalletService,
  DriverWalletServiceError,
} from "../services/driverWalletService";

function getTraceId(req: Request): string {
  const headerTrace = req.headers["x-trace-id"];
  if (typeof headerTrace === "string" && headerTrace.trim()) {
    return headerTrace.trim();
  }
  return `trace_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (Number.isNaN(n)) return undefined;
  return n;
}

function toOptionalDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

function handleError(req: Request, res: Response, error: unknown) {
  const traceId = getTraceId(req);

  if (error instanceof DriverWalletServiceError) {
    res.status(error.status).json({
      success: false,
      message: error.message,
      code: error.code,
      details: error.details || null,
      traceId,
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: "Erro interno ao processar carteira do motorista.",
    code: "INTERNAL_ERROR",
    traceId,
  });
}

export const driverWalletController = {
  async getSummary(req: Request, res: Response) {
    try {
      const driverUserId = req.user?.id as string;
      const period =
        typeof req.query.period === "string" ? req.query.period : undefined;
      const payload = await driverWalletService.getSummary(driverUserId, period);
      res.status(200).json(payload);
    } catch (error) {
      handleError(req, res, error);
    }
  },

  async getActivities(req: Request, res: Response) {
    try {
      const driverUserId = req.user?.id as string;
      const type =
        typeof req.query.type === "string"
          ? (req.query.type as
              | "RIDE_CREDIT"
              | "BONUS"
              | "PIX_TRANSFER_DEBIT"
              | "ADJUSTMENT")
          : undefined;

      const payload = await driverWalletService.getActivities(driverUserId, {
        type,
        from: toOptionalDate(req.query.from),
        to: toOptionalDate(req.query.to),
        limit: toOptionalNumber(req.query.limit),
        offset: toOptionalNumber(req.query.offset),
      });

      res.status(200).json(payload);
    } catch (error) {
      handleError(req, res, error);
    }
  },

  async createPixTransfer(req: Request, res: Response) {
    try {
      const driverUserId = req.user?.id as string;
      const idempotencyKey = req.headers["idempotency-key"];
      const idempotency =
        typeof idempotencyKey === "string"
          ? idempotencyKey
          : Array.isArray(idempotencyKey)
            ? idempotencyKey[0]
            : undefined;

      const payload = await driverWalletService.createPixTransfer(
        driverUserId,
        {
          cpf: req.body?.cpf,
          amount: req.body?.amount,
        },
        idempotency,
      );

      res.status(201).json(payload);
    } catch (error) {
      handleError(req, res, error);
    }
  },

  async getTransfer(req: Request, res: Response) {
    try {
      const driverUserId = req.user?.id as string;
      const transferId = req.params.transferId as string;
      const payload = await driverWalletService.getTransfer(driverUserId, transferId);
      res.status(200).json(payload);
    } catch (error) {
      handleError(req, res, error);
    }
  },

  async getTransferReceipt(req: Request, res: Response) {
    try {
      const driverUserId = req.user?.id as string;
      const transferId = req.params.transferId as string;
      const payload = await driverWalletService.getTransferReceipt(
        driverUserId,
        transferId,
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(req, res, error);
    }
  },
};

