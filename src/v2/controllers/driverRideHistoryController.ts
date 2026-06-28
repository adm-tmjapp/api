import { Request, Response } from "express";
import {
  driverRideHistoryService,
  DriverRideHistoryServiceError,
} from "../services/driverRideHistoryService";

function toOptionalDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  if (Number.isNaN(num)) return undefined;
  return num;
}

function handleError(res: Response, error: unknown) {
  if (error instanceof DriverRideHistoryServiceError) {
    res.status(error.status).json({
      statusCode: error.status,
      error: error.code,
      message: error.message,
      details: {},
    });
    return;
  }

  res.status(500).json({
    statusCode: 500,
    error: "INTERNAL_ERROR",
    message: "Erro interno ao processar histórico de corridas.",
    details: {},
  });
}

export const driverRideHistoryController = {
  async getSummary(req: Request, res: Response) {
    try {
      const driverUserId = req.user?.id as string;
      const period =
        typeof req.query.period === "string"
          ? (req.query.period as "week" | "month" | "custom")
          : undefined;

      const payload = await driverRideHistoryService.getSummary(driverUserId, {
        period,
        startDate: toOptionalDate(req.query.startDate),
        endDate: toOptionalDate(req.query.endDate),
      });

      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async getHistory(req: Request, res: Response) {
    try {
      const driverUserId = req.user?.id as string;
      const period =
        typeof req.query.period === "string"
          ? (req.query.period as "week" | "month" | "custom")
          : undefined;

      const payload = await driverRideHistoryService.getHistory(driverUserId, {
        period,
        startDate: toOptionalDate(req.query.startDate),
        endDate: toOptionalDate(req.query.endDate),
        page: toOptionalNumber(req.query.page),
        limit: toOptionalNumber(req.query.limit),
      });

      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async getHistoryDetail(req: Request, res: Response) {
    try {
      const driverUserId = req.user?.id as string;
      const rideId = req.params.rideId as string;
      const payload = await driverRideHistoryService.getHistoryDetail(
        driverUserId,
        rideId,
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },
};
