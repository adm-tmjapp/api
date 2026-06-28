import { Request, Response } from "express";
import {
  driverDashboardService,
  type PendingRideFilters,
  ServiceError,
} from "../services/driverDashboardService";

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) return undefined;
  return numberValue;
}

function parsePendingFilters(req: Request) {
  const categoryRaw =
    typeof req.query.category === "string" ? req.query.category : undefined;
  const category =
    categoryRaw === "delivery" || categoryRaw === "passenger"
      ? categoryRaw
      : undefined;

  const filters: PendingRideFilters = {
    highPriority: toOptionalBoolean(req.query.highPriority),
    category,
    lat: toOptionalNumber(req.query.lat),
    lng: toOptionalNumber(req.query.lng),
    radiusKm: toOptionalNumber(req.query.radiusKm),
    limit: toOptionalNumber(req.query.limit),
    offset: toOptionalNumber(req.query.offset),
  };

  return filters;
}

function handleError(res: Response, error: unknown) {
  if (error instanceof ServiceError) {
    res.status(error.status).json({
      success: false,
      message: error.message,
      code: error.code,
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: "Erro interno ao processar solicitação.",
    code: "INTERNAL_ERROR",
  });
}

export const driverDashboardController = {
  async getDashboard(req: Request, res: Response) {
    try {
      const driverUserId = req.user?.id as string;
      const payload = await driverDashboardService.getDashboard(
        driverUserId,
        parsePendingFilters(req),
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async updateAvailability(req: Request, res: Response) {
    try {
      const availability = req.body?.availability;
      if (availability !== "ONLINE" && availability !== "OFFLINE") {
        res.status(400).json({
          success: false,
          message: "Campo availability deve ser ONLINE ou OFFLINE.",
          code: "INVALID_AVAILABILITY",
        });
        return;
      }

      const driverUserId = req.user?.id as string;
      const payload = await driverDashboardService.updateAvailability(
        driverUserId,
        availability,
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async listPendingRides(req: Request, res: Response) {
    try {
      const payload = await driverDashboardService.getPendingRides(
        parsePendingFilters(req),
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async acceptRide(req: Request, res: Response) {
    try {
      const rideId = req.params.rideId as string;
      const driverUserId = req.user?.id as string;
      const payload = await driverDashboardService.acceptRide(driverUserId, rideId);
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async arriveRide(req: Request, res: Response) {
    try {
      const rideId = req.params.rideId as string;
      const driverUserId = req.user?.id as string;
      const payload = await driverDashboardService.markRideArrived(
        driverUserId,
        rideId,
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async startRide(req: Request, res: Response) {
    try {
      const rideId = req.params.rideId as string;
      const driverUserId = req.user?.id as string;
      const payload = await driverDashboardService.startRide(driverUserId, rideId);
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async completeRide(req: Request, res: Response) {
    try {
      const rideId = req.params.rideId as string;
      const driverUserId = req.user?.id as string;
      const payload = await driverDashboardService.completeRide(
        driverUserId,
        rideId,
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async getCurrentRide(req: Request, res: Response) {
    try {
      const driverUserId = req.user?.id as string;
      const payload = await driverDashboardService.getCurrentRide(driverUserId);
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },
};
