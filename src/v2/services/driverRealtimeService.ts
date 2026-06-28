import mongoose from "mongoose";
import admin from "../../config/firebase";
import Ride from "../../models/Ride";
import RideLocationSnapshot from "../../models/RideLocationSnapshot";

type ServiceErrorCode =
  | "INVALID_RIDE_ID"
  | "RIDE_NOT_FOUND"
  | "RIDE_NOT_ASSIGNED"
  | "INVALID_LAT_LNG"
  | "SNAPSHOT_RATE_LIMITED"
  | "FIREBASE_TOKEN_ERROR";

export class DriverRealtimeServiceError extends Error {
  status: number;

  code: ServiceErrorCode;

  details?: Record<string, unknown>;

  constructor(
    status: number,
    code: ServiceErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const SNAPSHOT_MIN_INTERVAL_MS = 15000;
const REALTIME_TOKEN_TTL_MINUTES = 60;

function parseCoordinate(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new DriverRealtimeServiceError(
      400,
      "INVALID_LAT_LNG",
      "Latitude/longitude inválidas.",
    );
  }
  return num;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const earthRadiusM = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusM * c;
}

function getTargetCoordinates(ride: any): { lat: number; lng: number } | null {
  const status = String(ride?.status || "").toLowerCase();
  const target =
    status === "accepted"
      ? ride?.pickup_location?.coordinates
      : ride?.destination_location?.coordinates;

  if (
    typeof target?.latitude !== "number" ||
    typeof target?.longitude !== "number"
  ) {
    return null;
  }

  return {
    lat: target.latitude,
    lng: target.longitude,
  };
}

async function ensureDriverOwnsRide(rideId: string, driverUserId: string) {
  if (!mongoose.Types.ObjectId.isValid(rideId)) {
    throw new DriverRealtimeServiceError(
      400,
      "INVALID_RIDE_ID",
      "Ride ID inválido.",
    );
  }

  const ride = await Ride.findById(rideId).lean();
  if (!ride) {
    throw new DriverRealtimeServiceError(
      404,
      "RIDE_NOT_FOUND",
      "Corrida não encontrada.",
    );
  }

  const rideDriverId = String((ride as any)?.driver?.id || "");
  if (!rideDriverId || rideDriverId !== driverUserId) {
    throw new DriverRealtimeServiceError(
      403,
      "RIDE_NOT_ASSIGNED",
      "Corrida não está atribuída ao motorista autenticado.",
    );
  }

  return ride;
}

function getFirebaseDatabaseUrl(): string {
  return (
    process.env.FIREBASE_DATABASE_URL ||
    process.env.FIREBASE_DB_URL ||
    ""
  ).trim();
}

export const driverRealtimeService = {
  async issueRealtimeToken(rideId: string, driverUserId: string) {
    await ensureDriverOwnsRide(rideId, driverUserId);

    const expiresAt = new Date(Date.now() + REALTIME_TOKEN_TTL_MINUTES * 60000);
    const dbUrl = getFirebaseDatabaseUrl();
    const claims = {
      role: "driver",
      rideId,
      canRead: true,
      canWrite: ["driver_location", "presence"],
      tokenExpiresAt: expiresAt.toISOString(),
    };

    try {
      const token = await admin.auth().createCustomToken(driverUserId, claims);
      return {
        success: true,
        firebase: {
          dbUrl,
          customToken: token,
          expiresAt: expiresAt.toISOString(),
          rideId,
          role: "driver",
        },
      };
    } catch (error) {
      throw new DriverRealtimeServiceError(
        500,
        "FIREBASE_TOKEN_ERROR",
        "Falha ao gerar token realtime.",
      );
    }
  },

  async saveLocationSnapshot(
    rideId: string,
    driverUserId: string,
    input: {
      lat: unknown;
      lng: unknown;
      speed?: unknown;
      heading?: unknown;
      accuracy?: unknown;
      capturedAt?: unknown;
      source?: unknown;
    },
  ) {
    const ride = await ensureDriverOwnsRide(rideId, driverUserId);
    const lat = parseCoordinate(input.lat);
    const lng = parseCoordinate(input.lng);

    const lastSnapshot = await RideLocationSnapshot.findOne({
      rideId,
      driverUserId,
    })
      .sort({ capturedAt: -1 })
      .lean();

    const capturedAt =
      input.capturedAt && !Number.isNaN(Date.parse(String(input.capturedAt)))
        ? new Date(String(input.capturedAt))
        : new Date();

    if (
      lastSnapshot?.capturedAt &&
      capturedAt.getTime() - new Date(lastSnapshot.capturedAt).getTime() <
        SNAPSHOT_MIN_INTERVAL_MS
    ) {
      const retryAfterMs =
        SNAPSHOT_MIN_INTERVAL_MS -
        (capturedAt.getTime() - new Date(lastSnapshot.capturedAt).getTime());

      throw new DriverRealtimeServiceError(
        429,
        "SNAPSHOT_RATE_LIMITED",
        "Aguarde para enviar novo snapshot de localização.",
        { retryAfterMs },
      );
    }

    const source = input.source === "backend" ? "backend" : "mobile";
    const speed = input.speed !== undefined ? Number(input.speed) : null;
    const heading = input.heading !== undefined ? Number(input.heading) : null;
    const accuracy = input.accuracy !== undefined ? Number(input.accuracy) : null;

    const snapshot = await RideLocationSnapshot.create({
      rideId,
      driverUserId,
      lat,
      lng,
      speed: Number.isFinite(speed as number) ? speed : null,
      heading: Number.isFinite(heading as number) ? heading : null,
      accuracy: Number.isFinite(accuracy as number) ? accuracy : null,
      source,
      capturedAt,
    });

    const dbUrl = getFirebaseDatabaseUrl();
    if (dbUrl) {
      try {
        await admin
          .database()
          .ref(`rides_live/${rideId}/driver_location`)
          .set({
            lat,
            lng,
            speed: snapshot.speed ?? null,
            heading: snapshot.heading ?? null,
            accuracy: snapshot.accuracy ?? null,
            ts: capturedAt.getTime(),
          });
      } catch (_error) {
        // Snapshot oficial foi persistido no backend; falha realtime nao invalida request.
      }
    }

    return {
      success: true,
      snapshot: {
        id: String(snapshot._id),
        rideId,
        lat,
        lng,
        speed: snapshot.speed,
        heading: snapshot.heading,
        accuracy: snapshot.accuracy,
        source: snapshot.source,
        capturedAt: snapshot.capturedAt,
      },
      rideStatus: String((ride as any).status || "").toLowerCase(),
    };
  },

  async getRideEta(rideId: string, driverUserId: string) {
    const ride = await ensureDriverOwnsRide(rideId, driverUserId);

    const latestSnapshot = await RideLocationSnapshot.findOne({
      rideId,
      driverUserId,
    })
      .sort({ capturedAt: -1 })
      .lean();

    if (!latestSnapshot) {
      return {
        success: true,
        rideId,
        status: String((ride as any).status || "").toLowerCase(),
        eta: null,
      };
    }

    const target = getTargetCoordinates(ride);
    if (!target) {
      return {
        success: true,
        rideId,
        status: String((ride as any).status || "").toLowerCase(),
        eta: null,
      };
    }

    const distanceM = haversineDistanceMeters(
      latestSnapshot.lat,
      latestSnapshot.lng,
      target.lat,
      target.lng,
    );
    const fallbackSpeedMps = 8.33; // ~30 km/h
    const speedMps =
      latestSnapshot.speed && latestSnapshot.speed > 1
        ? latestSnapshot.speed
        : fallbackSpeedMps;
    const etaSec = Math.max(0, Math.round(distanceM / speedMps));

    return {
      success: true,
      rideId,
      status: String((ride as any).status || "").toLowerCase(),
      eta: {
        distanceM: Math.round(distanceM),
        etaSec,
        basedOnSnapshotAt: latestSnapshot.capturedAt,
      },
    };
  },
};
