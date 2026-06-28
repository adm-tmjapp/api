import mongoose from "mongoose";
import Driver from "../../models/Driver";

export class DriverLocationServiceError extends Error {
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

const LOCATION_MIN_INTERVAL_MS = 5000;

function parseCoordinate(value: unknown, field: "lat" | "lng") {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    throw new DriverLocationServiceError(
      422,
      "VALIDATION_ERROR",
      "Localização inválida.",
      { field },
    );
  }
  return numberValue;
}

function parseOptionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export const driverLocationService = {
  async update(driverUserId: string, input: Record<string, unknown>) {
    if (!mongoose.Types.ObjectId.isValid(driverUserId)) {
      throw new DriverLocationServiceError(
        422,
        "VALIDATION_ERROR",
        "Motorista inválido.",
      );
    }

    const driver = await Driver.findOne({ userId: driverUserId });
    if (!driver) {
      throw new DriverLocationServiceError(
        404,
        "DRIVER_NOT_FOUND",
        "Motorista não encontrado.",
      );
    }

    const now = new Date();
    if (
      driver.lastLocationAt &&
      now.getTime() - new Date(driver.lastLocationAt).getTime() < LOCATION_MIN_INTERVAL_MS
    ) {
      throw new DriverLocationServiceError(
        429,
        "LOCATION_RATE_LIMITED",
        "Aguarde antes de enviar nova localização.",
        {
          retryAfterMs:
            LOCATION_MIN_INTERVAL_MS -
            (now.getTime() - new Date(driver.lastLocationAt).getTime()),
        },
      );
    }

    const lat = parseCoordinate(input.lat, "lat");
    const lng = parseCoordinate(input.lng, "lng");
    const heading = parseOptionalNumber(input.heading);
    const speed = parseOptionalNumber(input.speed);
    const accuracy = parseOptionalNumber(input.accuracy);

    driver.location = {
      type: "Point",
      coordinates: [lng, lat],
    };
    driver.lastLocationAt = now;
    driver.lastHeading = heading;
    driver.lastSpeed = speed;
    driver.lastAccuracy = accuracy;
    await driver.save();

    return {
      success: true,
      location: {
        lat,
        lng,
        heading,
        speed,
        accuracy,
        updatedAt: now.toISOString(),
      },
    };
  },
};
