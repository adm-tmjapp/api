import mongoose from "mongoose";
import Driver from "../../models/Driver";
import Ride from "../../models/Ride";
import User from "../../models/User";

type DriverAvailability = "ONLINE" | "OFFLINE";

export type PendingRideFilters = {
  highPriority?: boolean;
  category?: "delivery" | "passenger";
  lat?: number;
  lng?: number;
  radiusKm?: number;
  limit?: number;
  offset?: number;
};

type ServiceErrorCode =
  | "DRIVER_NOT_FOUND"
  | "INVALID_RIDE_ID"
  | "RIDE_NOT_FOUND"
  | "RIDE_NOT_AVAILABLE"
  | "DRIVER_OFFLINE"
  | "RIDE_NOT_ASSIGNED"
  | "RIDE_INVALID_STATUS";

export class ServiceError extends Error {
  status: number;

  code: ServiceErrorCode;

  constructor(status: number, code: ServiceErrorCode, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const DASHBOARD_DEFAULT_LIMIT = 20;
const DASHBOARD_MAX_LIMIT = 100;
const DASHBOARD_RECENT_RIDES_LIMIT = 5;
const DAILY_GOAL_RIDES = 12;

function parseMoney(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const earthRadiusKm = 6371;
  const dLat = degreesToRadians(lat2 - lat1);
  const dLng = degreesToRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degreesToRadians(lat1)) *
      Math.cos(degreesToRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function normalizeLimit(limit?: number): number {
  if (!limit || Number.isNaN(limit) || limit <= 0) return DASHBOARD_DEFAULT_LIMIT;
  return Math.min(limit, DASHBOARD_MAX_LIMIT);
}

function normalizeOffset(offset?: number): number {
  if (!offset || Number.isNaN(offset) || offset < 0) return 0;
  return offset;
}

function mapRideStatusToExternal(status?: string): string {
  if (!status) return "pending";
  return status.toLowerCase();
}

function mapAvailability(isAvailable: boolean): DriverAvailability {
  return isAvailable ? "ONLINE" : "OFFLINE";
}

function getRidePickupCoordinates(ride: any): { lat: number; lng: number } | null {
  const lat = ride?.pickup_location?.coordinates?.latitude;
  const lng = ride?.pickup_location?.coordinates?.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return { lat, lng };
}

function toPendingRideItem(ride: any) {
  const pickupAddress = ride?.pickup_location?.address || "";
  const dropoffAddress = ride?.destination_location?.address || "";
  const pickupCoordinates = ride?.pickup_location?.coordinates || {};
  const dropoffCoordinates = ride?.destination_location?.coordinates || {};

  return {
    id: String(ride?._id),
    typeLabel:
      ride?.typeLabel ||
      ride?.product?.name ||
      (ride?.category === "delivery" ? "Entrega" : "Corrida"),
    category: ride?.category || "passenger",
    highPriority: Boolean(ride?.highPriority),
    routeLabel: `${pickupAddress} -> ${dropoffAddress}`.trim(),
    distanceKm: ride?.route?.distance_km || 0,
    etaMin: ride?.route?.duration_min || 0,
    price: parseMoney(ride?.fare?.total_amount ?? ride?.product?.price),
    paymentMethod: ride?.payment_method || "APP",
    pickup: {
      address: pickupAddress,
      lat: pickupCoordinates.latitude || null,
      lng: pickupCoordinates.longitude || null,
    },
    dropoff: {
      address: dropoffAddress,
      lat: dropoffCoordinates.latitude || null,
      lng: dropoffCoordinates.longitude || null,
    },
  };
}

function toCurrentRide(ride: any) {
  if (!ride) return null;
  const baseRide = toPendingRideItem(ride);
  return {
    ...baseRide,
    status: mapRideStatusToExternal(ride.status),
    acceptedAt: ride.acceptedAt || null,
    arrivedAt: ride.arrivedAt || null,
    pickedUpAt: ride.pickedUpAt || null,
    completedAt: ride.completedAt || null,
  };
}

function toRideLifecyclePayload(ride: any) {
  return {
    id: String(ride?._id),
    status: mapRideStatusToExternal(ride?.status),
    acceptedAt: ride?.acceptedAt || null,
    arrivedAt: ride?.arrivedAt || null,
    pickedUpAt: ride?.pickedUpAt || null,
    completedAt: ride?.completedAt || null,
  };
}

async function ensureDriverByUserId(userId: string) {
  const driver = await Driver.findOne({ userId });
  if (!driver) {
    throw new ServiceError(404, "DRIVER_NOT_FOUND", "Motorista não encontrado.");
  }
  return driver;
}

function buildBasePendingFilters(filters: PendingRideFilters): Record<string, unknown> {
  const query: Record<string, unknown> = { status: "pending" };

  if (typeof filters.highPriority === "boolean") {
    (query as any).highPriority = filters.highPriority;
  }

  if (filters.category) {
    (query as any).category = filters.category;
  }

  return query;
}

function applyRadiusFilter(items: any[], filters: PendingRideFilters): any[] {
  if (
    typeof filters.lat !== "number" ||
    typeof filters.lng !== "number" ||
    typeof filters.radiusKm !== "number"
  ) {
    return items;
  }

  return items.filter((ride) => {
    const pickup = getRidePickupCoordinates(ride);
    if (!pickup) return false;
    const distance = haversineDistanceKm(filters.lat!, filters.lng!, pickup.lat, pickup.lng);
    return distance <= filters.radiusKm!;
  });
}

async function findCurrentRide(driverUserId: string): Promise<any | null> {
  return Ride.findOne({
    "driver.id": driverUserId,
    status: { $in: ["accepted", "ongoing"] },
  })
    .sort({ acceptedAt: -1, requestedAt: -1, _id: -1 })
    .lean();
}

async function ensureDriverRide(rideId: string, driverUserId: string): Promise<any> {
  if (!mongoose.Types.ObjectId.isValid(rideId)) {
    throw new ServiceError(400, "INVALID_RIDE_ID", "Ride ID inválido.");
  }

  const ride = await Ride.findById(rideId).lean();
  if (!ride) {
    throw new ServiceError(404, "RIDE_NOT_FOUND", "Corrida não encontrada.");
  }

  if (String((ride as any)?.driver?.id || "") != driverUserId) {
    throw new ServiceError(
      403,
      "RIDE_NOT_ASSIGNED",
      "Essa corrida não está vinculada a este motorista.",
    );
  }

  return ride;
}

export const driverDashboardService = {
  async getPendingRides(filters: PendingRideFilters) {
    const limit = normalizeLimit(filters.limit);
    const offset = normalizeOffset(filters.offset);
    const query = buildBasePendingFilters(filters);

    const rides = (await Ride.find(query)
      .sort({ requestedAt: -1, _id: -1 })
      .lean()) as any[];

    const withRadius = applyRadiusFilter(rides, filters);
    const total = withRadius.length;
    const paged = withRadius.slice(offset, offset + limit);

    return {
      success: true,
      items: paged.map(toPendingRideItem),
      total,
      limit,
      offset,
    };
  },

  async getCurrentRide(driverUserId: string) {
    const ride = await findCurrentRide(driverUserId);
    return {
      success: true,
      ride: toCurrentRide(ride),
    };
  },

  async getDashboard(driverUserId: string, filters: PendingRideFilters) {
    const driver = await ensureDriverByUserId(driverUserId);

    const pending = await this.getPendingRides({
      ...filters,
      limit: DASHBOARD_RECENT_RIDES_LIMIT,
      offset: 0,
    });

    const currentRide = await findCurrentRide(driverUserId);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const todayCompleted = (await Ride.find({
      "driver.id": driverUserId,
      status: "completed",
      completedAt: { $gte: todayStart, $lt: tomorrowStart },
    }).lean()) as any[];

    const todayRides = todayCompleted.length;
    const todayEarnings = Number(
      todayCompleted
        .reduce((acc, ride) => acc + parseMoney(ride?.fare?.total_amount ?? ride?.product?.price), 0)
        .toFixed(2),
    );
    const progressPercent = Math.min(
      100,
      Math.round((todayRides / DAILY_GOAL_RIDES) * 100),
    );

    return {
      success: true,
      availability: mapAvailability(Boolean((driver as any).isAvailable)),
      summary: {
        todayRides,
        todayEarnings,
        progressPercent,
      },
      pendingRides: pending.items,
      currentRide: toCurrentRide(currentRide),
    };
  },

  async updateAvailability(driverUserId: string, availability: DriverAvailability) {
    const isAvailable = availability === "ONLINE";

    const driver = await Driver.findOneAndUpdate(
      { userId: driverUserId },
      { $set: { isAvailable } },
      { new: true },
    );

    if (!driver) {
      throw new ServiceError(404, "DRIVER_NOT_FOUND", "Motorista não encontrado.");
    }

    return {
      success: true,
      availability: mapAvailability(Boolean((driver as any).isAvailable)),
      updatedAt: new Date().toISOString(),
    };
  },

  async acceptRide(driverUserId: string, rideId: string) {
    if (!mongoose.Types.ObjectId.isValid(rideId)) {
      throw new ServiceError(400, "INVALID_RIDE_ID", "Ride ID inválido.");
    }

    const driver = await ensureDriverByUserId(driverUserId);

    if (!(driver as any).isAvailable) {
      throw new ServiceError(
        422,
        "DRIVER_OFFLINE",
        "Motorista offline. Fique online para aceitar corridas.",
      );
    }

    const rideExists = await Ride.findById(rideId).select("_id status");
    if (!rideExists) {
      throw new ServiceError(404, "RIDE_NOT_FOUND", "Corrida não encontrada.");
    }

    const driverUser = await User.findById(driverUserId)
      .select("name phone profilePhoto")
      .lean();

    const acceptedAt = new Date();
    const acceptedRide = await Ride.findOneAndUpdate(
      {
        _id: rideId,
        status: "pending",
        $or: [
          { "driver.id": { $exists: false } },
          { "driver.id": null },
          { "driver.id": "" },
        ],
      },
      {
        $set: {
          status: "accepted",
          acceptedAt,
          "driver.id": driverUserId,
          "driver.name": (driverUser as any)?.name || undefined,
          "driver.phone_number": (driverUser as any)?.phone || undefined,
          "driver.photo_url": (driverUser as any)?.profilePhoto || undefined,
        },
      },
      { new: true },
    ).lean();

    if (!acceptedRide) {
      throw new ServiceError(
        409,
        "RIDE_NOT_AVAILABLE",
        "Corrida já aceita ou indisponível.",
      );
    }

    return {
      success: true,
      ride: {
        id: String((acceptedRide as any)._id),
        status: "accepted",
        driverId: driverUserId,
        acceptedAt: (acceptedRide as any).acceptedAt || acceptedAt.toISOString(),
      },
    };
  },

  async markRideArrived(driverUserId: string, rideId: string) {
    await ensureDriverByUserId(driverUserId);
    const ride = await ensureDriverRide(rideId, driverUserId);
    const currentStatus = String((ride as any).status || "").toLowerCase();

    if (currentStatus == "completed" || currentStatus == "canceled") {
      throw new ServiceError(
        409,
        "RIDE_INVALID_STATUS",
        "A corrida não pode ser marcada como chegada no estado atual.",
      );
    }

    if ((ride as any).arrivedAt) {
      return {
        success: true,
        ride: toRideLifecyclePayload(ride),
      };
    }

    const arrivedAt = new Date();
    const updatedRide = await Ride.findOneAndUpdate(
      {
        _id: rideId,
        "driver.id": driverUserId,
        status: "accepted",
      },
      {
        $set: {
          arrivedAt,
        },
      },
      { new: true },
    ).lean();

    if (!updatedRide) {
      throw new ServiceError(
        409,
        "RIDE_INVALID_STATUS",
        "A corrida precisa estar aceita para marcar chegada.",
      );
    }

    return {
      success: true,
      ride: toRideLifecyclePayload(updatedRide),
    };
  },

  async startRide(driverUserId: string, rideId: string) {
    await ensureDriverByUserId(driverUserId);
    const ride = await ensureDriverRide(rideId, driverUserId);
    const currentStatus = String((ride as any).status || "").toLowerCase();

    if (currentStatus == "ongoing") {
      return {
        success: true,
        ride: toRideLifecyclePayload(ride),
      };
    }

    if (currentStatus != "accepted") {
      throw new ServiceError(
        409,
        "RIDE_INVALID_STATUS",
        "A corrida precisa estar aceita para iniciar.",
      );
    }

    const pickedUpAt = new Date();
    const updatedRide = await Ride.findOneAndUpdate(
      {
        _id: rideId,
        "driver.id": driverUserId,
        status: "accepted",
      },
      {
        $set: {
          status: "ongoing",
          pickedUpAt,
          arrivedAt: (ride as any).arrivedAt || pickedUpAt,
        },
      },
      { new: true },
    ).lean();

    if (!updatedRide) {
      throw new ServiceError(
        409,
        "RIDE_INVALID_STATUS",
        "Não foi possível iniciar a corrida no estado atual.",
      );
    }

    return {
      success: true,
      ride: toRideLifecyclePayload(updatedRide),
    };
  },

  async completeRide(driverUserId: string, rideId: string) {
    await ensureDriverByUserId(driverUserId);
    const ride = await ensureDriverRide(rideId, driverUserId);
    const currentStatus = String((ride as any).status || "").toLowerCase();

    if (currentStatus == "completed") {
      return {
        success: true,
        ride: toRideLifecyclePayload(ride),
      };
    }

    if (currentStatus != "ongoing") {
      throw new ServiceError(
        409,
        "RIDE_INVALID_STATUS",
        "A corrida precisa estar em curso para ser concluída.",
      );
    }

    const completedAt = new Date();
    const updatedRide = await Ride.findOneAndUpdate(
      {
        _id: rideId,
        "driver.id": driverUserId,
        status: "ongoing",
      },
      {
        $set: {
          status: "completed",
          completedAt,
        },
      },
      { new: true },
    ).lean();

    if (!updatedRide) {
      throw new ServiceError(
        409,
        "RIDE_INVALID_STATUS",
        "Não foi possível concluir a corrida no estado atual.",
      );
    }

    return {
      success: true,
      ride: toRideLifecyclePayload(updatedRide),
    };
  },
};
