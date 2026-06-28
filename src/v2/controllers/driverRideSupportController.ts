import { Request, Response } from "express";
import {
  driverRideSupportService,
  DriverRideSupportServiceError,
} from "../services/driverRideSupportService";

function handleError(res: Response, error: unknown) {
  if (error instanceof DriverRideSupportServiceError) {
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
    message: "Erro interno ao processar suporte da corrida.",
    details: {},
  });
}

export const driverRideSupportController = {
  async getSupportOptions(req: Request, res: Response) {
    try {
      const driverUserId = req.user?.id as string;
      const rideId = req.params.rideId as string;
      const payload = await driverRideSupportService.getSupportOptions(
        rideId,
        driverUserId,
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async createSupportTicket(req: Request, res: Response) {
    try {
      const driverUserId = req.user?.id as string;
      const rideId = req.params.rideId as string;
      const payload = await driverRideSupportService.createGenericSupportTicket(
        rideId,
        driverUserId,
        {
          issueCode: req.body?.issueCode,
          subject: req.body?.subject,
          description: req.body?.description,
          attachments: req.body?.attachments,
        },
      );
      res.status(201).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async createPaymentIssue(req: Request, res: Response) {
    try {
      const driverUserId = req.user?.id as string;
      const rideId = req.params.rideId as string;
      const payload = await driverRideSupportService.createPaymentIssue(
        rideId,
        driverUserId,
        {
          expectedAmount: Number(req.body?.expectedAmount),
          receivedAmount: Number(req.body?.receivedAmount),
          description: req.body?.description,
          attachments: req.body?.attachments,
        },
      );
      res.status(201).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async createForgottenObject(req: Request, res: Response) {
    try {
      const driverUserId = req.user?.id as string;
      const rideId = req.params.rideId as string;
      const payload = await driverRideSupportService.createForgottenObject(
        rideId,
        driverUserId,
        {
          description: req.body?.description,
          attachments: req.body?.attachments,
        },
      );
      res.status(201).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async createPassengerAbsent(req: Request, res: Response) {
    try {
      const driverUserId = req.user?.id as string;
      const rideId = req.params.rideId as string;
      const payload = await driverRideSupportService.createPassengerAbsent(
        rideId,
        driverUserId,
        {
          waitedMoreThan5Minutes: req.body?.waitedMoreThan5Minutes,
          calledPassenger: req.body?.calledPassenger,
          messagedPassenger: req.body?.messagedPassenger,
          atBoardingPoint: req.body?.atBoardingPoint,
          driverLat: req.body?.driverLat,
          driverLng: req.body?.driverLng,
          gpsEvidenceId: req.body?.gpsEvidenceId,
        },
      );
      res.status(201).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async getSupportContact(_req: Request, res: Response) {
    try {
      const payload = driverRideSupportService.getSupportContact();
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },
};

