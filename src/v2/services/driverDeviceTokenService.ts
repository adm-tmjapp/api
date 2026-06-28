import mongoose from "mongoose";
import Driver from "../../models/Driver";
import DriverDeviceToken from "../../models/DriverDeviceToken";

export class DriverDeviceTokenServiceError extends Error {
  statusCode: number;

  code: string;

  details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const driverDeviceTokenService = {
  async register(
    driverUserId: string,
    input: {
      provider?: unknown;
      token?: unknown;
      platform?: unknown;
    },
  ) {
    if (!mongoose.Types.ObjectId.isValid(driverUserId)) {
      throw new DriverDeviceTokenServiceError(
        422,
        "VALIDATION_ERROR",
        "Motorista inválido.",
      );
    }

    const driver = await Driver.findOne({ userId: driverUserId }).lean();
    if (!driver) {
      throw new DriverDeviceTokenServiceError(
        404,
        "DRIVER_NOT_FOUND",
        "Motorista não encontrado.",
      );
    }

    const provider = String(input.provider || "fcm").trim().toLowerCase();
    const token = String(input.token || "").trim();
    const platform = String(input.platform || "").trim().toLowerCase();

    if (provider !== "fcm") {
      throw new DriverDeviceTokenServiceError(
        422,
        "VALIDATION_ERROR",
        "Provider de push inválido.",
        { field: "provider" },
      );
    }

    if (!token) {
      throw new DriverDeviceTokenServiceError(
        422,
        "VALIDATION_ERROR",
        "Token do dispositivo é obrigatório.",
        { field: "token" },
      );
    }

    if (platform !== "android" && platform !== "ios") {
      throw new DriverDeviceTokenServiceError(
        422,
        "VALIDATION_ERROR",
        "Platform inválido.",
        { field: "platform" },
      );
    }

    await DriverDeviceToken.findOneAndUpdate(
      {
        driverUserId: new mongoose.Types.ObjectId(driverUserId),
        token,
      },
      {
        $set: {
          provider: "fcm",
          platform,
          isActive: true,
          lastSeenAt: new Date(),
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );

    return {
      success: true,
      message: "Token do dispositivo atualizado com sucesso.",
    };
  },

  async listActiveTokens(driverUserIds: string[]) {
    const validIds = driverUserIds
      .filter((value) => mongoose.Types.ObjectId.isValid(value))
      .map((value) => new mongoose.Types.ObjectId(value));

    if (!validIds.length) return [];

    return DriverDeviceToken.find({
      driverUserId: { $in: validIds },
      provider: "fcm",
      isActive: true,
    }).lean();
  },

  async deactivateToken(token: string) {
    if (!token) return;
    await DriverDeviceToken.updateOne(
      { token },
      {
        $set: {
          isActive: false,
        },
      },
    );
  },
};
