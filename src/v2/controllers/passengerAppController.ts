import { Request, Response } from "express";
import {
  passengerAppService,
  PassengerAppServiceError,
} from "../services/passengerAppService";

function handleError(res: Response, error: unknown) {
  if (error instanceof PassengerAppServiceError) {
    res.status(error.statusCode).json({
      statusCode: error.statusCode,
      error: error.code,
      message: error.message,
      details: error.details || {},
    });
    return;
  }

  res.status(500).json({
    statusCode: 500,
    error: "INTERNAL_ERROR",
    message: "Erro interno ao processar recursos do passageiro.",
    details: {},
  });
}

export const passengerAppController = {
  async createRide(req: Request, res: Response) {
    try {
      const passengerUserId = req.user?.id as string;
      const payload = await passengerAppService.createRide(passengerUserId, req.body || {});
      res.status(201).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async checkoutRide(req: Request, res: Response) {
    try {
      const passengerUserId = req.user?.id as string;
      const payload = await passengerAppService.checkoutRide(
        passengerUserId,
        req.params.id as string,
        req.body || {},
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async listRides(req: Request, res: Response) {
    try {
      const passengerUserId = req.user?.id as string;
      const payload = await passengerAppService.listRides(
        passengerUserId,
        typeof req.query.status === "string" ? req.query.status : undefined,
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async getRide(req: Request, res: Response) {
    try {
      const passengerUserId = req.user?.id as string;
      const payload = await passengerAppService.getRide(passengerUserId, req.params.id as string);
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async getRideStatus(req: Request, res: Response) {
    try {
      const passengerUserId = req.user?.id as string;
      const payload = await passengerAppService.getRideStatus(
        passengerUserId,
        req.params.id as string,
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async cancelRide(req: Request, res: Response) {
    try {
      const passengerUserId = req.user?.id as string;
      const payload = await passengerAppService.cancelRide(
        passengerUserId,
        req.params.id as string,
        req.body?.reason,
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async issueRealtimeToken(req: Request, res: Response) {
    try {
      const passengerUserId = req.user?.id as string;
      const payload = await passengerAppService.issueRealtimeToken(
        passengerUserId,
        req.params.id as string,
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async getRideEta(req: Request, res: Response) {
    try {
      const passengerUserId = req.user?.id as string;
      const payload = await passengerAppService.getRideEta(passengerUserId, req.params.id as string);
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async createPayment(req: Request, res: Response) {
    try {
      const passengerUserId = req.user?.id as string;
      const payload = await passengerAppService.createPayment(passengerUserId, req.body || {});
      res.status(201).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async listPaymentMethods(req: Request, res: Response) {
    try {
      const passengerUserId = req.user?.id as string;
      const payload = await passengerAppService.listPaymentMethods(passengerUserId);
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async createPaymentMethod(req: Request, res: Response) {
    try {
      const passengerUserId = req.user?.id as string;
      const payload = await passengerAppService.createPaymentMethod(
        passengerUserId,
        req.body || {},
      );
      res.status(201).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async deletePaymentMethod(req: Request, res: Response) {
    try {
      const passengerUserId = req.user?.id as string;
      const payload = await passengerAppService.deletePaymentMethod(
        passengerUserId,
        req.params.id as string,
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async setDefaultPaymentMethod(req: Request, res: Response) {
    try {
      const passengerUserId = req.user?.id as string;
      const payload = await passengerAppService.setDefaultPaymentMethod(
        passengerUserId,
        req.params.id as string,
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async uploadProfilePhoto(req: Request, res: Response) {
    try {
      const passengerUserId = req.user?.id as string;
      const payload = await passengerAppService.uploadProfilePhoto(
        passengerUserId,
        (req as any).file,
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async getAddress(req: Request, res: Response) {
    try {
      const passengerUserId = req.user?.id as string;
      const payload = await passengerAppService.getAddress(passengerUserId);
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async updateAddress(req: Request, res: Response) {
    try {
      const passengerUserId = req.user?.id as string;
      const payload = await passengerAppService.updateAddress(passengerUserId, req.body || {});
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async getAddressHistory(req: Request, res: Response) {
    try {
      const passengerUserId = req.user?.id as string;
      const payload = await passengerAppService.getAddressHistory(passengerUserId);
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async saveAddressHistory(req: Request, res: Response) {
    try {
      const passengerUserId = req.user?.id as string;
      const payload = await passengerAppService.saveAddressHistory(
        passengerUserId,
        req.body || {},
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async getOnboardingStatus(req: Request, res: Response) {
    try {
      const passengerUserId = req.user?.id as string;
      const payload = await passengerAppService.getOnboardingStatus(passengerUserId);
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async listNotifications(req: Request, res: Response) {
    try {
      const passengerUserId = req.user?.id as string;
      const payload = await passengerAppService.listNotifications(passengerUserId);
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async markNotificationRead(req: Request, res: Response) {
    try {
      const passengerUserId = req.user?.id as string;
      const payload = await passengerAppService.markNotificationRead(
        passengerUserId,
        req.params.id as string,
      );
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async markAllNotificationsRead(req: Request, res: Response) {
    try {
      const passengerUserId = req.user?.id as string;
      const payload = await passengerAppService.markAllNotificationsRead(passengerUserId);
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },

  async getSupportContact(_req: Request, res: Response) {
    try {
      const payload = passengerAppService.getSupportContact();
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error);
    }
  },
};
