import mongoose from "mongoose";
import User from "../../models/User";
import PassengerDeviceToken from "../../models/PassengerDeviceToken";

export class PassengerDeviceTokenServiceError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string) { super(message); }
}

export const passengerDeviceTokenService = {
  async register(passengerUserId: string, input: Record<string, unknown>) {
    if (!mongoose.Types.ObjectId.isValid(passengerUserId)) throw new PassengerDeviceTokenServiceError(422, "INVALID_USER", "Passageiro inválido.");
    const user = await User.findById(passengerUserId).select("role").lean();
    if (!user || user.role !== "passenger") throw new PassengerDeviceTokenServiceError(404, "PASSENGER_NOT_FOUND", "Passageiro não encontrado.");
    const token = String(input.token || "").trim();
    const platform = String(input.platform || "").trim().toLowerCase();
    if (!token || (platform !== "android" && platform !== "ios")) throw new PassengerDeviceTokenServiceError(422, "VALIDATION_ERROR", "Token e plataforma são obrigatórios.");
    await PassengerDeviceToken.findOneAndUpdate({ passengerUserId: new mongoose.Types.ObjectId(passengerUserId), token }, { $set: { provider: "fcm", platform, isActive: true, lastSeenAt: new Date() } }, { upsert: true, setDefaultsOnInsert: true });
    return { success: true, message: "Token do passageiro atualizado com sucesso." };
  },
  async listActiveTokens(passengerUserId: string) {
    if (!mongoose.Types.ObjectId.isValid(passengerUserId)) return [];
    return PassengerDeviceToken.find({ passengerUserId: new mongoose.Types.ObjectId(passengerUserId), provider: "fcm", isActive: true }).lean();
  },
  async deactivateToken(token: string) { if (token) await PassengerDeviceToken.updateOne({ token }, { $set: { isActive: false } }); },
};
