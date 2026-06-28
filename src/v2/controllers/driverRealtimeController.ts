import { Request, Response } from "express";
import {
  DriverRealtimeServiceError,
  driverRealtimeService,
} from "../services/driverRealtimeService";

function getTraceId(req: Request): string {
  const headerTrace = req.headers["x-trace-id"];
  if (typeof headerTrace === "string" && headerTrace.trim()) {
    return headerTrace.trim();
  }
  return `trace_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function handleError(req: Request, res: Response, error: unknown) {
  const traceId = getTraceId(req);

  if (error instanceof DriverRealtimeServiceError) {
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
    message: "Erro interno ao processar tracking realtime.",
    code: "INTERNAL_ERROR",
    traceId,
  });
}

export const driverRealtimeController = {
  async issueRealtimeToken(req: Request, res: Response) {
    try {
      const rideId = req.params.rideId as string;
      const driverUserId = req.user?.id as string;
      const payload = await driverRealtimeService.issueRealtimeToken(
        rideId,
        driverUserId,
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(req, res, error);
    }
  },

  async saveLocationSnapshot(req: Request, res: Response) {
    try {
      const rideId = req.params.rideId as string;
      const driverUserId = req.user?.id as string;
      const payload = await driverRealtimeService.saveLocationSnapshot(
        rideId,
        driverUserId,
        req.body || {},
      );
      res.status(201).json(payload);
    } catch (error) {
      handleError(req, res, error);
    }
  },

  async getRideEta(req: Request, res: Response) {
    try {
      const rideId = req.params.rideId as string;
      const driverUserId = req.user?.id as string;
      const payload = await driverRealtimeService.getRideEta(rideId, driverUserId);
      res.status(200).json(payload);
    } catch (error) {
      handleError(req, res, error);
    }
  },
};

