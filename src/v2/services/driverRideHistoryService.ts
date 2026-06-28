import mongoose from "mongoose";
import Ride from "../../models/Ride";

type HistoryPeriod = "week" | "month" | "custom";

type HistoryFilters = {
  period?: HistoryPeriod;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
};

type ServiceErrorCode = "INVALID_RIDE_ID" | "RIDE_NOT_FOUND" | "INVALID_DATE_RANGE";

export class DriverRideHistoryServiceError extends Error {
  status: number;

  code: ServiceErrorCode;

  constructor(status: number, code: ServiceErrorCode, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

function normalizePage(page?: number): number {
  if (!page || Number.isNaN(page) || page <= 0) return DEFAULT_PAGE;
  return Math.floor(page);
}

function normalizeLimit(limit?: number): number {
  if (!limit || Number.isNaN(limit) || limit <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.floor(limit));
}

function parseMoney(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getPeriodRange(period?: HistoryPeriod, startDate?: Date, endDate?: Date) {
  const now = new Date();
  const periodValue = period || "week";

  if (periodValue === "custom") {
    if (!startDate || !endDate) {
      throw new DriverRideHistoryServiceError(
        400,
        "INVALID_DATE_RANGE",
        "startDate e endDate são obrigatórios para period=custom.",
      );
    }

    if (startDate > endDate) {
      throw new DriverRideHistoryServiceError(
        400,
        "INVALID_DATE_RANGE",
        "startDate não pode ser maior que endDate.",
      );
    }

    return { period: periodValue, start: startDate, end: endDate };
  }

  const end = now;
  const start = new Date(now);

  if (periodValue === "week") {
    start.setDate(start.getDate() - 7);
  } else {
    start.setMonth(start.getMonth() - 1);
  }

  return { period: periodValue, start, end };
}

function getPreviousRange(start: Date, end: Date) {
  const duration = end.getTime() - start.getTime();
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - duration);
  return {
    previousStart,
    previousEnd,
  };
}

function calculateGrowthPercent(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }

  return Number((((current - previous) / previous) * 100).toFixed(2));
}

function buildHistoryQuery(driverUserId: string, start: Date, end: Date) {
  return {
    "driver.id": driverUserId,
    status: "completed",
    completedAt: {
      $gte: start,
      $lte: end,
    },
  };
}

function getRideStartedAt(ride: any) {
  return ride?.pickedUpAt || ride?.acceptedAt || ride?.requestedAt || null;
}

function getRideEndedAt(ride: any) {
  return ride?.completedAt || null;
}

function getRideDurationMinutes(ride: any) {
  const startedAt = getRideStartedAt(ride);
  const endedAt = getRideEndedAt(ride);

  if (startedAt && endedAt) {
    return Math.max(
      0,
      Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000),
    );
  }

  return ride?.route?.duration_min || 0;
}

function getAppFee(ride: any) {
  return Number(
    parseMoney(
      ride?.fare?.breakdown?.service_fee ?? ride?.product?.fare_breakdown?.valorTaxa,
    ).toFixed(2),
  );
}

function getGrossAmount(ride: any) {
  return Number(parseMoney(ride?.fare?.total_amount ?? ride?.product?.price).toFixed(2));
}

function getNetAmount(ride: any) {
  const grossAmount = getGrossAmount(ride);
  const appFee = getAppFee(ride);
  return Number((grossAmount - appFee).toFixed(2));
}

function getPaymentMethodLabel(paymentMethod?: string) {
  const normalized = String(paymentMethod || "").toUpperCase();
  if (normalized === "APP") return "Pagamento no app";
  if (normalized === "CASH") return "Dinheiro";
  if (normalized === "CREDIT_CARD" || normalized === "DEBIT_CARD") {
    return "Pago via Cartão de Crédito no App";
  }
  return paymentMethod || "Não informado";
}

function formatCurrencyBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

async function ensureRideBelongsToDriver(rideId: string, driverUserId: string) {
  if (!mongoose.Types.ObjectId.isValid(rideId)) {
    throw new DriverRideHistoryServiceError(400, "INVALID_RIDE_ID", "Ride ID inválido.");
  }

  const ride = await Ride.findOne({
    _id: rideId,
    "driver.id": driverUserId,
  }).lean();

  if (!ride) {
    throw new DriverRideHistoryServiceError(404, "RIDE_NOT_FOUND", "Corrida não encontrada.");
  }

  return ride;
}

export const driverRideHistoryService = {
  async getSummary(driverUserId: string, filters: HistoryFilters) {
    const { period, start, end } = getPeriodRange(
      filters.period,
      filters.startDate,
      filters.endDate,
    );
    const { previousStart, previousEnd } = getPreviousRange(start, end);

    const [currentRides, previousRides] = await Promise.all([
      Ride.find(buildHistoryQuery(driverUserId, start, end)).lean(),
      Ride.find(buildHistoryQuery(driverUserId, previousStart, previousEnd)).lean(),
    ]);

    const totalBilled = Number(
      currentRides.reduce((acc, ride) => acc + getGrossAmount(ride), 0).toFixed(2),
    );
    const totalRides = currentRides.length;
    const previousBilled = Number(
      previousRides.reduce((acc, ride) => acc + getGrossAmount(ride), 0).toFixed(2),
    );
    const previousRideCount = previousRides.length;

    return {
      totalBilled,
      totalRides,
      billedGrowthPercent: calculateGrowthPercent(totalBilled, previousBilled),
      ridesGrowthPercent: calculateGrowthPercent(totalRides, previousRideCount),
    };
  },

  async getHistory(driverUserId: string, filters: HistoryFilters) {
    const { period, start, end } = getPeriodRange(
      filters.period,
      filters.startDate,
      filters.endDate,
    );
    const page = normalizePage(filters.page);
    const limit = normalizeLimit(filters.limit);
    const skip = (page - 1) * limit;
    const query = buildHistoryQuery(driverUserId, start, end);

    const [rides, total] = await Promise.all([
      Ride.find(query)
        .sort({ completedAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Ride.countDocuments(query),
    ]);

    return {
      data: rides.map((ride: any) => {
        const netAmount = getNetAmount(ride);
        return {
          id: String(ride._id),
          status: "FINISHED",
          startedAt: getRideStartedAt(ride),
          endedAt: getRideEndedAt(ride),
          distanceKm: Number(parseMoney(ride?.route?.distance_km).toFixed(2)),
          originAddress: ride?.pickup_location?.address || null,
          destinationAddress: ride?.destination_location?.address || null,
          netAmount,
          netAmountFormatted: formatCurrencyBRL(netAmount),
        };
      }),
      meta: {
        page,
        limit,
        total,
      },
    };
  },

  async getHistoryDetail(driverUserId: string, rideId: string) {
    const ride: any = await ensureRideBelongsToDriver(rideId, driverUserId);
    const startedAt = getRideStartedAt(ride);
    const endedAt = getRideEndedAt(ride);
    const grossAmount = getGrossAmount(ride);
    const appFee = getAppFee(ride);

    const netAmount = Number((grossAmount - appFee).toFixed(2));

    return {
      id: String(ride._id),
      status: "FINISHED",
      startedAt,
      endedAt,
      durationMinutes: getRideDurationMinutes(ride),
      distanceKm: Number(parseMoney(ride?.route?.distance_km).toFixed(2)),
      originAddress: ride?.pickup_location?.address || null,
      destinationAddress: ride?.destination_location?.address || null,
      originLat: ride?.pickup_location?.coordinates?.latitude ?? null,
      originLng: ride?.pickup_location?.coordinates?.longitude ?? null,
      destinationLat: ride?.destination_location?.coordinates?.latitude ?? null,
      destinationLng: ride?.destination_location?.coordinates?.longitude ?? null,
      grossAmount,
      grossAmountFormatted: formatCurrencyBRL(grossAmount),
      appFee,
      netAmount,
      netAmountFormatted: formatCurrencyBRL(netAmount),
      paymentMethodLabel: getPaymentMethodLabel(ride?.payment_method),
      passengerName: ride?.rider?.name || null,
      passengerPhotoUrl: ride?.rider?.photo_url || null,
      polyline: ride?.route?.encoded_polyline || null,
    };
  },
};
