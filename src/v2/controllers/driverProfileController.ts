import { Request, Response } from "express";
import {
  driverProfileService,
  DriverProfileServiceError,
} from "../services/driverProfileService";

function handleError(res: Response, error: unknown) {
  if (error instanceof DriverProfileServiceError) {
    res.status(error.status).json({
      statusCode: error.status,
      error: error.code,
      message: error.message,
      details: error.details || {},
    });
    return;
  }

  res.status(500).json({
    statusCode: 500,
    error: "INTERNAL_ERROR",
    message: "Erro interno ao processar perfil do motorista.",
    details: {},
  });
}

export const driverProfileController = {
  async getProfile(req: Request, res: Response) {
    try {
      const driverUserId = req.user?.id as string;
      const payload = await driverProfileService.getProfile(driverUserId);
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async updateProfile(req: Request, res: Response) {
    try {
      const driverUserId = req.user?.id as string;
      const payload = await driverProfileService.updateProfile(driverUserId, {
        name: req.body?.name,
        email: req.body?.email,
        phone: req.body?.phone,
        cpf: req.body?.cpf,
      });
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async getVehicle(req: Request, res: Response) {
    try {
      const driverUserId = req.user?.id as string;
      const payload = await driverProfileService.getActiveVehicle(driverUserId);
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async getDocuments(req: Request, res: Response) {
    try {
      const driverUserId = req.user?.id as string;
      const payload = await driverProfileService.getDocuments(driverUserId);
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async getAddress(req: Request, res: Response) {
    try {
      const driverUserId = req.user?.id as string;
      const payload = await driverProfileService.getAddress(driverUserId);
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async updateAddress(req: Request, res: Response) {
    try {
      const driverUserId = req.user?.id as string;
      const payload = await driverProfileService.updateAddress(driverUserId, req.body || {});
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async getAddressHistory(req: Request, res: Response) {
    try {
      const driverUserId = req.user?.id as string;
      const payload = await driverProfileService.getAddressHistory(driverUserId);
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async saveAddressHistory(req: Request, res: Response) {
    try {
      const driverUserId = req.user?.id as string;
      const payload = await driverProfileService.saveAddressHistory(driverUserId, req.body || {});
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async getSecurity(_req: Request, res: Response) {
    try {
      const payload = await driverProfileService.getSecurity();
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },
};
