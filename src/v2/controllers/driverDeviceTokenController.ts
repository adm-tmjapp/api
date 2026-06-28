import { Request, Response } from "express";
import {
  driverDeviceTokenService,
  DriverDeviceTokenServiceError,
} from "../services/driverDeviceTokenService";

function handleError(res: Response, error: unknown) {
  if (error instanceof DriverDeviceTokenServiceError) {
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
    message: typed.message || "Erro interno ao registrar token do dispositivo.",
    details: {},
  });
}

export const driverDeviceTokenController = {
  async register(req: Request, res: Response) {
    try {
      const payload = await driverDeviceTokenService.register(
        req.user?.id as string,
        req.body || {},
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },
};
