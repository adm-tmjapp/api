import { Request, Response } from "express";
import {
  driverLocationService,
  DriverLocationServiceError,
} from "../services/driverLocationService";

function handleError(res: Response, error: unknown) {
  if (error instanceof DriverLocationServiceError) {
    res.status(error.statusCode).json({
      statusCode: error.statusCode,
      error: error.code,
      message: error.message,
      details: error.details || {},
    });
    return;
  }

  const typed = error as Error;
  res.status(500).json({
    statusCode: 500,
    error: "INTERNAL_ERROR",
    message: typed.message || "Erro interno ao atualizar localização.",
    details: {},
  });
}

export const driverLocationController = {
  async update(req: Request, res: Response) {
    try {
      const payload = await driverLocationService.update(
        req.user?.id as string,
        req.body || {},
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },
};
