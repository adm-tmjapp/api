import Driver from "../../models/Driver";
import Ride from "../../models/Ride";
import RideDispatchAttempt from "../../models/RideDispatchAttempt";
import { driverDeviceTokenService } from "./driverDeviceTokenService";
import { driverPushService } from "./driverPushService";

function parsePositiveNumberEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const LOCATION_FRESHNESS_MS = parsePositiveNumberEnv(
  "DRIVER_MATCHING_LOCATION_FRESHNESS_MS",
  120000,
);
const INITIAL_RADIUS_KM = parsePositiveNumberEnv(
  "DRIVER_MATCHING_INITIAL_RADIUS_KM",
  3,
);
const MAX_CANDIDATES = Math.floor(
  parsePositiveNumberEnv("DRIVER_MATCHING_MAX_CANDIDATES", 10),
);
const DISPATCH_TIMEOUT_MS = parsePositiveNumberEnv(
  "DRIVER_MATCHING_DISPATCH_TIMEOUT_MS",
  10000,
);

function parseRidePrice(ride: any): number {
  const value = ride?.fare?.total_amount ?? ride?.product?.price ?? 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function getRidePickup(ride: any) {
  const coordinates = ride?.pickup_location?.coordinates;
  if (
    typeof coordinates?.latitude !== "number" ||
    typeof coordinates?.longitude !== "number"
  ) {
    return null;
  }

  return {
    lat: coordinates.latitude,
    lng: coordinates.longitude,
    address: ride?.pickup_location?.address || null,
  };
}

export const rideMatchingService = {
  async startDispatch(rideId: string) {
    const ride = await Ride.findById(rideId).lean();
    if (!ride) {
      console.warn("[rideMatchingService.startDispatch] ride not found", { rideId });
      return {
        success: false,
        code: "RIDE_NOT_FOUND",
      };
    }

    if (String((ride as any).status || "").toLowerCase() !== "pending") {
      console.warn("[rideMatchingService.startDispatch] ride is not pending", {
        rideId,
        status: String((ride as any).status || ""),
      });
      return {
        success: false,
        code: "RIDE_NOT_PENDING",
      };
    }

    const pickup = getRidePickup(ride);
    if (!pickup) {
      console.warn("[rideMatchingService.startDispatch] ride without pickup coordinates", {
        rideId,
      });
      return {
        success: false,
        code: "RIDE_WITHOUT_PICKUP_COORDINATES",
      };
    }

    const freshnessLimit = new Date(Date.now() - LOCATION_FRESHNESS_MS);
    const drivers = (await Driver.find({
      isAvailable: true,
      lastLocationAt: { $gte: freshnessLimit },
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [pickup.lng, pickup.lat],
          },
          $maxDistance: INITIAL_RADIUS_KM * 1000,
        },
      },
    })
      .limit(MAX_CANDIDATES)
      .lean()) as any[];

    const candidateDriverUserIds = drivers
      .map((driver) => String(driver.userId || ""))
      .filter(Boolean);

    console.info("[rideMatchingService.startDispatch] matching candidates loaded", {
      rideId,
      candidateCount: candidateDriverUserIds.length,
      radiusKm: INITIAL_RADIUS_KM,
    });

    const dispatchRound =
      (await RideDispatchAttempt.countDocuments({ rideId })) + 1;
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + DISPATCH_TIMEOUT_MS);

    const attempt = await RideDispatchAttempt.create({
      rideId,
      dispatchRound,
      radiusKm: INITIAL_RADIUS_KM,
      candidateDriverUserIds,
      notifiedDriverUserIds: [],
      status: "OPEN",
      startedAt,
      expiresAt,
    });

    const tokens = await driverDeviceTokenService.listActiveTokens(candidateDriverUserIds);
    console.info("[rideMatchingService.startDispatch] active tokens loaded", {
      rideId,
      candidateCount: candidateDriverUserIds.length,
      tokenCount: tokens.length,
    });
    const notifications = await driverPushService.sendNewRideRequest(
      tokens.map((item) => ({
        driverUserId: String(item.driverUserId),
        token: item.token,
      })),
      {
        rideId: String((ride as any)._id),
        pickupAddress: pickup.address,
        distanceKm: Number((ride as any)?.route?.distance_km || 0),
        etaMin: Number((ride as any)?.route?.duration_min || 0),
        price: parseRidePrice(ride),
      },
    );

    attempt.notifiedDriverUserIds = notifications.notifiedDriverUserIds as any;
    await attempt.save();

    return {
      success: true,
      rideId: String((ride as any)._id),
      dispatchRound,
      radiusKm: INITIAL_RADIUS_KM,
      dispatchTimeoutMs: DISPATCH_TIMEOUT_MS,
      startedAt: startedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      candidates: candidateDriverUserIds.map((driverUserId) => {
        const driver = drivers.find((item) => String(item.userId) === driverUserId);
        const coordinates = driver?.location?.coordinates || [];
        const lng = Number(coordinates[0]);
        const lat = Number(coordinates[1]);
        return {
          driverUserId,
          distanceKm:
            Number.isFinite(lat) && Number.isFinite(lng)
              ? Number(distanceKm(pickup.lat, pickup.lng, lat, lng).toFixed(2))
              : null,
          notified: notifications.notifiedDriverUserIds.includes(driverUserId),
        };
      }),
      notifiedDriverUserIds: notifications.notifiedDriverUserIds,
    };
  },
};
