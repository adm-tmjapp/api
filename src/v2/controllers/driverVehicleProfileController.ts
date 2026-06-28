import { Request, Response } from "express";
import {
  driverVehicleProfileService,
  DriverVehicleProfileServiceError,
} from "../services/driverVehicleProfileService";

function handleError(res: Response, error: unknown) {
  if (error instanceof DriverVehicleProfileServiceError) {
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
    message: "Erro interno ao processar veículos do motorista.",
    details: {},
  });
}

export const driverVehicleProfileController = {
  async listVehicles(req: Request, res: Response) {
    try {
      const driverUserId = req.user?.id as string;
      const payload = await driverVehicleProfileService.listVehicles(driverUserId);
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async activateVehicle(req: Request, res: Response) {
    try {
      const driverUserId = req.user?.id as string;
      const payload = await driverVehicleProfileService.activateVehicle(
        driverUserId,
        req.params.vehicleId as string,
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async getDocuments(req: Request, res: Response) {
    try {
      const driverUserId = req.user?.id as string;
      const payload = await driverVehicleProfileService.getVehicleDocuments(
        driverUserId,
        req.params.vehicleId as string,
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async uploadDocuments(req: Request, res: Response) {
    try {
      const driverUserId = req.user?.id as string;
      const payload = await driverVehicleProfileService.uploadVehicleDocument(
        driverUserId,
        req.params.vehicleId as string,
        req.body?.type,
        req.file,
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async uploadPhoto(req: Request, res: Response) {
    try {
      const driverUserId = req.user?.id as string;
      const payload = await driverVehicleProfileService.uploadVehiclePhoto(
        driverUserId,
        req.params.vehicleId as string,
        req.file,
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async createVehicle(req: Request, res: Response) {
    try {
      const driverUserId = req.user?.id as string;
      const payload = await driverVehicleProfileService.createVehicle(
        driverUserId,
        {
          manufacturer: req.body?.manufacturer,
          modelName: req.body?.modelName,
          year: req.body?.year,
          vehiclePlate: req.body?.vehiclePlate,
          color: req.body?.color,
          vehicleType: req.body?.vehicleType,
          renavam: req.body?.renavam,
        },
      );
      res.status(201).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },
};
