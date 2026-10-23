import { Request, Response } from "express";
import { passengerDeviceTokenService, PassengerDeviceTokenServiceError } from "../services/passengerDeviceTokenService";

export const passengerDeviceTokenController = {
  async register(req: Request, res: Response) {
    try { res.status(200).json(await passengerDeviceTokenService.register(req.user?.id as string, req.body || {})); }
    catch (error) { if (error instanceof PassengerDeviceTokenServiceError) { res.status(error.statusCode).json({ success: false, code: error.code, message: error.message }); return; } res.status(500).json({ success: false, code: "INTERNAL_ERROR", message: "Não foi possível registrar o dispositivo." }); }
  },
};
