import mongoose from "mongoose";
import AdminAuditLog from "../../models/AdminAuditLog";
import Driver from "../../models/Driver";
import DriverDocument from "../../models/DriverDocument";
import RidePayment from "../../models/RidePayment";
import Product from "../../models/Product";
import Ride from "../../models/Ride";
import User from "../../models/User";
import Vehicle from "../../models/Vehicle";
import VehiclePhoto from "../../models/VehiclePhoto";
import DriverDocumentService from "../../services/driverDocumentService";
import { OnboardingService } from "../../services/onboardingService";
import VehicleService from "../../services/vehicleService";

type AdminPeriod = "weekly" | "biweekly" | "monthly";

class AdminBackofficeError extends Error {
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

function toLoggableError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return { value: error };
}

function ensureObjectId(value: string, field: string) {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new AdminBackofficeError(422, "VALIDATION_ERROR", `${field} inválido.`, {
      field,
    });
  }
}

function getDocumentTimestamp(doc: any) {
  if (doc?.createdAt instanceof Date) return doc.createdAt;
  if (doc?._id instanceof mongoose.Types.ObjectId) return doc._id.getTimestamp();
  return null;
}

function getPeriodStart(period: AdminPeriod) {
  const now = new Date();
  const start = new Date(now);

  if (period === "weekly") {
    start.setDate(now.getDate() - 6);
  } else if (period === "biweekly") {
    start.setDate(now.getDate() - 13);
  } else {
    start.setDate(now.getDate() - 29);
  }

  start.setHours(0, 0, 0, 0);
  return start;
}

function getPreviousPeriodStart(start: Date, period: AdminPeriod) {
  const previous = new Date(start);
  if (period === "weekly") {
    previous.setDate(previous.getDate() - 7);
  } else if (period === "biweekly") {
    previous.setDate(previous.getDate() - 14);
  } else {
    previous.setDate(previous.getDate() - 30);
  }
  return previous;
}

function growthPercent(current: number, previous: number) {
  if (!previous && !current) return 0;
  if (!previous) return 100;
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

function toDateBucketIndex(date: Date, start: Date, end: Date) {
  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0) return 0;
  const normalized = Math.max(0, Math.min(date.getTime() - start.getTime(), totalMs));
  return Math.min(6, Math.floor((normalized / totalMs) * 7));
}

function mapAuthOnboardingStatus(payload: any) {
  if (!payload) return null;
  if (payload.isCompleted) return "COMPLETED";
  if (payload.isUnderReview) return "UNDER_REVIEW";
  return "PENDING";
}

function buildRideDate(ride: any) {
  return (
    ride?.completedAt ||
    ride?.pickedUpAt ||
    ride?.acceptedAt ||
    ride?.requestedAt ||
    getDocumentTimestamp(ride)
  );
}

function isValidObjectId(value?: string | null) {
  return Boolean(value && mongoose.Types.ObjectId.isValid(value));
}

function buildRideTimeline(ride: any) {
  return [
    {
      key: "requested",
      label: "Solicitada",
      at: ride?.requestedAt || getDocumentTimestamp(ride),
      done: Boolean(ride?.requestedAt || getDocumentTimestamp(ride)),
    },
    {
      key: "accepted",
      label: "Aceita",
      at: ride?.acceptedAt || null,
      done: Boolean(ride?.acceptedAt),
    },
    {
      key: "pickup",
      label: "Embarque",
      at: ride?.pickedUpAt || null,
      done: Boolean(ride?.pickedUpAt),
    },
    {
      key: "completed",
      label: "Concluida",
      at: ride?.completedAt || null,
      done: String(ride?.status || "").toLowerCase() === "completed",
    },
    {
      key: "canceled",
      label: "Cancelada",
      at:
        String(ride?.status || "").toLowerCase() === "canceled"
          ? ride?.completedAt || ride?.pickedUpAt || ride?.acceptedAt || ride?.requestedAt || getDocumentTimestamp(ride)
          : null,
      done: String(ride?.status || "").toLowerCase() === "canceled",
    },
  ];
}

function getRideTotalAmount(ride: any) {
  return Number(ride?.fare?.total_amount ?? ride?.product?.price ?? 0);
}

function getRideFareBreakdown(ride: any) {
  return {
    baseFare: Number(
      ride?.fare?.breakdown?.base_fare ?? ride?.product?.fare_breakdown?.valorBase ?? 0,
    ),
    distanceFee: Number(
      ride?.fare?.breakdown?.distance_fee ?? ride?.product?.fare_breakdown?.valorKm ?? 0,
    ),
    timeFee: Number(
      ride?.fare?.breakdown?.time_fee ?? ride?.route?.duration_min ?? 0,
    ),
    serviceFee: Number(
      ride?.fare?.breakdown?.service_fee ?? ride?.product?.fare_breakdown?.valorTaxa ?? 0,
    ),
  };
}

function buildRideSummary(ride: any) {
  return {
    id: String(ride._id),
    status: ride.status || null,
    requestedAt: ride.requestedAt || getDocumentTimestamp(ride),
    acceptedAt: ride.acceptedAt || null,
    completedAt: ride.completedAt || null,
    paymentMethod: ride.payment_method || null,
    passengerId: ride.passengerId || null,
    rider: {
      id: ride?.rider?.id || ride?.passengerId || null,
      name: ride?.rider?.name || null,
      phone: ride?.rider?.phone_number || null,
    },
    driver: {
      id: ride?.driver?.id || null,
      name: ride?.driver?.name || null,
      phone: ride?.driver?.phone_number || null,
      rating: ride?.driver?.rating ?? null,
    },
    vehicle: {
      licensePlate: ride?.vehicle?.license_plate || null,
      model: ride?.vehicle?.model || null,
      color: ride?.vehicle?.color || null,
      type: ride?.vehicle?.type || null,
    },
    fare: {
      currency: ride?.fare?.currency || "BRL",
      totalAmount: getRideTotalAmount(ride),
      breakdown: getRideFareBreakdown(ride),
    },
    product: {
      id: ride?.product?.id || null,
      name: ride?.product?.name || null,
      price: ride?.product?.price ?? null,
    },
    route: {
      distanceKm: ride?.route?.distance_km ?? null,
      durationMin: ride?.route?.duration_min ?? null,
    },
    locations: {
      pickupAddress: ride?.pickup_location?.address || null,
      destinationAddress: ride?.destination_location?.address || null,
    },
  };
}

export const adminBackofficeService = {
  async recordAudit(input: {
    adminUserId?: string;
    action: string;
    targetType: string;
    targetId?: string;
    details?: Record<string, unknown>;
  }) {
    await AdminAuditLog.create({
      adminUserId: input.adminUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      details: input.details,
    });
  },

  async getDashboard(period: AdminPeriod = "monthly") {
    const now = new Date();
    const start = getPeriodStart(period);
    const previousStart = getPreviousPeriodStart(start, period);

    const [rides, activeDrivers, totalPassengers, pendingDocs, pendingVehicles] =
      await Promise.all([
        Ride.find({
          status: "completed",
          completedAt: { $gte: previousStart },
        }).lean(),
        User.countDocuments({ role: "driver", authStatus: "ACTIVE" }),
        User.countDocuments({ role: "passenger" }),
        DriverDocument.countDocuments({ status: "PENDING" }),
        Vehicle.countDocuments({
          $or: [{ status: "PENDING" }, { documentationStatus: { $in: ["PENDING", "UNDER_REVIEW"] } }],
        }),
      ]);

    const currentRides = rides.filter((ride: any) => {
      const completedAt = ride.completedAt;
      return completedAt && completedAt >= start && completedAt <= now;
    });

    const previousRidesWindow = rides.filter((ride: any) => {
      const completedAt = ride.completedAt;
      return completedAt && completedAt >= previousStart && completedAt < start;
    });

    const revenueSeries = Array.from({ length: 7 }, () => 0);
    currentRides.forEach((ride: any) => {
      const completedAt = ride.completedAt;
      if (!completedAt) return;
      const index = toDateBucketIndex(completedAt, start, now);
      revenueSeries[index] += Number(ride.fare?.total_amount || 0);
    });

    const [pendingDrivers, pendingVehiclesList] = await Promise.all([
      DriverDocument.find({ status: "PENDING" })
        .sort({ updatedAt: -1, createdAt: -1 })
        .populate("user", "name email phone")
        .limit(5)
        .lean(),
      Vehicle.find({
        $or: [{ status: "PENDING" }, { documentationStatus: { $in: ["PENDING", "UNDER_REVIEW"] } }],
      })
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    return {
      success: true,
      stats: {
        totalRevenue: Number(
          currentRides.reduce((sum: number, item: any) => sum + Number(item.fare?.total_amount || 0), 0).toFixed(2),
        ),
        activeDrivers,
        totalPassengers,
        pendingApprovals: pendingDocs + pendingVehicles,
      },
      revenueSeries: revenueSeries.map((value) => Number(value.toFixed(2))),
      pendingDrivers: pendingDrivers.map((doc: any) => ({
        id: String(doc._id),
        type: doc.type,
        status: doc.status,
        createdAt: doc.createdAt,
        user: doc.user
          ? {
              id: String(doc.user._id),
              name: doc.user.name || null,
              email: doc.user.email || null,
              phone: doc.user.phone || null,
            }
          : null,
      })),
      pendingVehicles: pendingVehiclesList.map((vehicle: any) => ({
        id: String(vehicle._id),
        manufacturer: vehicle.manufacturer,
        modelName: vehicle.modelName,
        vehiclePlate: vehicle.vehiclePlate,
        status: vehicle.status,
        documentationStatus: vehicle.documentationStatus,
      })),
      trends: {
        revenueGrowthPercent: growthPercent(
          currentRides.reduce((sum: number, item: any) => sum + Number(item.fare?.total_amount || 0), 0),
          previousRidesWindow.reduce((sum: number, item: any) => sum + Number(item.fare?.total_amount || 0), 0),
        ),
        paymentsGrowthPercent: growthPercent(currentRides.length, previousRidesWindow.length),
      },
    };
  },

  async listUsers(input: {
    role?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(input.page || 1));
    const limit = Math.min(100, Math.max(1, Number(input.limit || 20)));
    const filter: Record<string, unknown> = {};

    if (input.role) filter.role = input.role;
    if (input.status) filter.authStatus = input.status;

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const enriched = await Promise.all(
      users.map(async (user: any) => {
        let onboardingStatus = null;
        if (user.role === "driver" || user.role === "admin") {
          onboardingStatus = mapAuthOnboardingStatus(
            await OnboardingService.buildDriverOnboarding(user),
          );
        }

        return {
          id: String(user._id),
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          authStatus: user.authStatus,
          createdAt: user.createdAt || getDocumentTimestamp(user),
          onboardingStatus,
        };
      }),
    );

    return {
      success: true,
      data: {
        users: enriched,
        total,
        page,
        limit,
      },
    };
  },

  async listPayments(input: {
    page?: number;
    limit?: number;
    status?: string;
    method?: string;
  }) {
    const page = Math.max(1, Number(input.page || 1));
    const limit = Math.min(100, Math.max(1, Number(input.limit || 20)));
    const filter: Record<string, unknown> = {};

    if (input.status) filter.status = input.status;
    if (input.method) filter.billingType = input.method;

    const [payments, total] = await Promise.all([
      RidePayment.find(filter)
        .sort({ _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      RidePayment.countDocuments(filter),
    ]);

    return {
      success: true,
      data: {
        payments: payments.map((payment: any) => ({
          id: String(payment._id),
          rideId: payment.rideId ? String(payment.rideId) : null,
          driverId: payment.driverId ? String(payment.driverId) : null,
          passengerId: payment.passengerId ? String(payment.passengerId) : null,
          amount: Number(payment.grossAmount || 0),
          paymentMethod: payment.billingType,
          status: payment.status,
          createdAt: getDocumentTimestamp(payment),
        })),
        total,
        page,
        limit,
      },
    };
  },

  async listRides(input: {
    page?: number;
    limit?: number;
    status?: string[];
    paymentMethod?: string;
    query?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const page = Math.max(1, Number(input.page || 1));
    const limit = Math.min(100, Math.max(1, Number(input.limit || 20)));
    const query = input.query?.trim();
    const baseFilter: Record<string, any> = {};

    if (input.paymentMethod) {
      baseFilter.payment_method = new RegExp(`^${input.paymentMethod}$`, "i");
    }

    if (input.startDate || input.endDate) {
      baseFilter.requestedAt = {};
      if (input.startDate) {
        baseFilter.requestedAt.$gte = new Date(input.startDate);
      }
      if (input.endDate) {
        const end = new Date(input.endDate);
        end.setHours(23, 59, 59, 999);
        baseFilter.requestedAt.$lte = end;
      }
    }

    if (query) {
      const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const objectIdClause = mongoose.Types.ObjectId.isValid(query)
        ? [{ _id: new mongoose.Types.ObjectId(query) }]
        : [];

      baseFilter.$or = [
        ...objectIdClause,
        { "rider.name": regex },
        { "driver.name": regex },
        { "pickup_location.address": regex },
        { "destination_location.address": regex },
        { payment_method: regex },
      ];
    }

    const listFilter = { ...baseFilter } as Record<string, any>;
    if (input.status?.length) {
      // Usar regex para busca case-insensitive de cada status no array
      listFilter.status = {
        $in: input.status.map((s) => new RegExp(`^${s}$`, "i")),
      };
    }

    const [rides, total, groupedStatus] = await Promise.all([
      Ride.find(listFilter)
        .sort({ requestedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Ride.countDocuments(listFilter),
      Ride.aggregate([
        { $match: baseFilter },
        { $group: { _id: "$status", total: { $sum: 1 } } },
      ]),
    ]);

    return {
      success: true,
      data: {
        rides: rides.map((ride: any) => buildRideSummary(ride)),
        total,
        page,
        limit,
        summary: {
          pending: 0,
          accepted: 0,
          ongoing: 0,
          completed: 0,
          canceled: 0,
          ...Object.fromEntries(
            groupedStatus.map((item: any) => [String(item._id || "unknown"), Number(item.total || 0)]),
          ),
        },
      },
    };
  },
  async adminCancelRide(rideId: string, reason?: string) {
    if (!mongoose.Types.ObjectId.isValid(rideId)) {
      throw new AdminBackofficeError(400, "INVALID_ID", "ID de corrida inválido.");
    }

    const ride = await Ride.findById(rideId);
    if (!ride) {
      throw new AdminBackofficeError(404, "NOT_FOUND", "Corrida não encontrada.");
    }

    if (["completed", "canceled"].includes(ride.status || "")) {
      throw new AdminBackofficeError(400, "INVALID_STATUS", "Corrida já está finalizada ou cancelada.");
    }

    ride.status = "canceled";
    ride.notes = reason || "Cancelado pelo administrador";
    await ride.save();

    await adminBackofficeService.recordAudit({
      action: "ADMIN_CANCEL_RIDE",
      targetType: "ride",
      targetId: rideId,
      details: { reason: ride.notes },
    });

    return { success: true, message: "Corrida cancelada com sucesso." };
  },

  async adminReassignDriver(rideId: string, driverId: string) {
    if (!mongoose.Types.ObjectId.isValid(rideId)) {
      throw new AdminBackofficeError(400, "INVALID_ID", "ID de corrida inválido.");
    }

    const [ride, driver] = await Promise.all([
      Ride.findById(rideId),
      Driver.findOne({ userId: driverId }).populate("userId"),
    ]);

    if (!ride) throw new AdminBackofficeError(404, "NOT_FOUND", "Corrida não encontrada.");
    if (!driver) throw new AdminBackofficeError(404, "NOT_FOUND", "Motorista não encontrado.");

    if (ride.status === "completed" || ride.status === "canceled") {
      throw new AdminBackofficeError(400, "INVALID_STATUS", "Não é possível reatribuir uma corrida finalizada.");
    }

    const driverUser = (driver as any).userId;

    ride.driver = {
      id: driverId,
      name: driverUser?.name || "Desconhecido",
      phone_number: driverUser?.phone || undefined,
      rating: driverUser?.rating || 5,
    };
    ride.status = "accepted"; // Reset status to accepted when reassigning
    await ride.save();

    await adminBackofficeService.recordAudit({
      action: "ADMIN_REASSIGN_DRIVER",
      targetType: "ride",
      targetId: rideId,
      details: { driverId, driverName: ride.driver.name },
    });

    return { success: true, message: "Motorista reatribuído com sucesso." };
  },

  async getRideDetails(rideId: string) {
    ensureObjectId(rideId, "rideId");

    const ride: any = await Ride.findById(rideId).lean();
    if (!ride) {
      throw new AdminBackofficeError(404, "NOT_FOUND", "Corrida não encontrada.", {
        rideId,
      });
    }

    const passengerUserId = String(ride?.rider?.id || ride?.passengerId || "");
    const driverUserId = String(ride?.driver?.id || "");

    const [passengerUser, driverUser, payments] = await Promise.all([
      isValidObjectId(passengerUserId)
        ? User.findById(passengerUserId)
            .select("name email phone authStatus profilePhoto")
            .lean()
        : null,
      isValidObjectId(driverUserId)
        ? User.findById(driverUserId)
            .select("name email phone authStatus profilePhoto")
            .lean()
        : null,
      RidePayment.find({ rideId: ride._id })
        .sort({ _id: -1 })
        .lean(),
    ]);

    return {
      success: true,
      data: {
        id: String(ride._id),
        status: ride.status || null,
        notes: ride.notes || null,
        paymentMethod: ride.payment_method || null,
        requestedAt: ride.requestedAt || getDocumentTimestamp(ride),
        acceptedAt: ride.acceptedAt || null,
        pickedUpAt: ride.pickedUpAt || null,
        completedAt: ride.completedAt || null,
        passenger: {
          id: passengerUserId || null,
          name: ride?.rider?.name || passengerUser?.name || null,
          email: passengerUser?.email || null,
          phone: ride?.rider?.phone_number || passengerUser?.phone || null,
          photoUrl: ride?.rider?.photo_url || passengerUser?.profilePhoto || null,
          authStatus: passengerUser?.authStatus || null,
        },
        driver: {
          id: driverUserId || null,
          name: ride?.driver?.name || driverUser?.name || null,
          email: driverUser?.email || null,
          phone: ride?.driver?.phone_number || driverUser?.phone || null,
          photoUrl: ride?.driver?.photo_url || driverUser?.profilePhoto || null,
          authStatus: driverUser?.authStatus || null,
          rating: ride?.driver?.rating || null,
        },
        vehicle: {
          licensePlate: ride?.vehicle?.license_plate || null,
          model: ride?.vehicle?.model || null,
          color: ride?.vehicle?.color || null,
          type: ride?.vehicle?.type || null,
        },
        locations: {
          pickup: {
            address: ride?.pickup_location?.address || null,
            coordinates: ride?.pickup_location?.coordinates || null,
          },
          destination: {
            address: ride?.destination_location?.address || null,
            coordinates: ride?.destination_location?.coordinates || null,
          },
        },
        route: {
          distanceKm: ride?.route?.distance_km ?? null,
          durationMin: ride?.route?.duration_min ?? null,
          encodedPolyline: ride?.route?.encoded_polyline || null,
        },
        fare: {
          currency: ride?.fare?.currency || "BRL",
          totalAmount: getRideTotalAmount(ride),
          breakdown: getRideFareBreakdown(ride),
        },
        product: {
          id: ride?.product?.id || null,
          name: ride?.product?.name || null,
          price: ride?.product?.price ?? null,
          description: ride?.product?.description || null,
          fareBreakdown: ride?.product?.fare_breakdown || null,
        },
        timeline: buildRideTimeline(ride),
        payments: payments.map((payment: any) => ({
          id: String(payment._id),
          amount: Number(payment.grossAmount || 0),
          status: payment.status || null,
          paymentMethod: payment.billingType || null,
          passengerId: payment.passengerId ? String(payment.passengerId) : null,
          driverId: payment.driverId ? String(payment.driverId) : null,
          createdAt: getDocumentTimestamp(payment),
        })),
        raw: {
          rider: ride?.rider || null,
          driver: ride?.driver || null,
          vehicle: ride?.vehicle || null,
          pickupLocation: ride?.pickup_location || null,
          destinationLocation: ride?.destination_location || null,
          route: ride?.route || null,
          product: ride?.product || null,
        },
      },
    };
  },

  async search(query: string) {
    const q = query.trim();
    if (q.length < 2) {
      throw new AdminBackofficeError(422, "VALIDATION_ERROR", "Busca inválida.", {
        field: "q",
      });
    }

    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    const [users, rides, vehicles, documents] = await Promise.all([
      User.find({
        $or: [{ name: regex }, { email: regex }, { phone: regex }],
      })
        .select("name email phone role authStatus")
        .limit(5)
        .lean(),
      Ride.find({
        $or: [
          { "rider.name": regex },
          { "driver.name": regex },
          { "pickup_location.address": regex },
          { "destination_location.address": regex },
        ],
      })
        .limit(5)
        .lean(),
      Vehicle.find({
        $or: [{ manufacturer: regex }, { modelName: regex }, { vehiclePlate: regex }],
      })
        .limit(5)
        .lean(),
      DriverDocument.find({
        $or: [{ type: regex }, { filename: regex }],
      })
        .limit(5)
        .populate("user", "name email phone")
        .lean(),
    ]);

    return {
      success: true,
      users: users.map((user: any) => ({
        id: String(user._id),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        authStatus: user.authStatus,
      })),
      rides: rides.map((ride: any) => ({
        id: String(ride._id),
        status: ride.status,
        passengerName: ride?.rider?.name || null,
        driverName: ride?.driver?.name || null,
        originAddress: ride?.pickup_location?.address || null,
        destinationAddress: ride?.destination_location?.address || null,
      })),
      vehicles: vehicles.map((vehicle: any) => ({
        id: String(vehicle._id),
        manufacturer: vehicle.manufacturer,
        modelName: vehicle.modelName,
        vehiclePlate: vehicle.vehiclePlate,
        status: vehicle.status,
      })),
      documents: documents.map((doc: any) => ({
        id: String(doc._id),
        type: doc.type,
        status: doc.status,
        user: doc.user
          ? {
              id: String(doc.user._id),
              name: doc.user.name || null,
              email: doc.user.email || null,
              phone: doc.user.phone || null,
            }
          : null,
      })),
    };
  },

  async listDriverDocuments(input: {
    page?: number;
    limit?: number;
    user?: string;
    type?: string;
    status?: string;
  }) {
    const page = Math.max(1, Number(input.page || 1));
    const limit = Math.min(100, Math.max(1, Number(input.limit || 20)));
    const filter: Record<string, unknown> = {};
    if (input.user) filter.user = input.user;
    if (input.type) filter.type = input.type;
    if (input.status) filter.status = input.status;

    const [documents, total] = await Promise.all([
      DriverDocument.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("user", "name email phone")
        .lean(),
      DriverDocument.countDocuments(filter),
    ]);

    return {
      success: true,
      data: {
        documents: documents.map((doc: any) => ({
          id: String(doc._id),
          user: doc.user
            ? {
                id: String(doc.user._id),
                name: doc.user.name || null,
                email: doc.user.email || null,
                phone: doc.user.phone || null,
              }
            : doc.user
              ? String(doc.user)
              : null,
          type: doc.type,
          side: doc.side || null,
          status: doc.status,
          fileUrl: doc.fileUrl,
          filename: doc.filename || null,
          reviewedAt: doc.reviewedAt || null,
          rejectionReason: doc.rejectionReason || null,
          createdAt: doc.createdAt,
        })),
        total,
        page,
        limit,
      },
    };
  },

  async approveDriverDocument(documentId: string, adminUserId?: string) {
    ensureObjectId(documentId, "documentId");
    const updated = await DriverDocumentService.approveDocument(documentId);
    if (!updated) {
      throw new AdminBackofficeError(404, "NOT_FOUND", "Documento não encontrado.");
    }

    await this.recordAudit({
      adminUserId,
      action: "DRIVER_DOCUMENT_APPROVE",
      targetType: "driver_document",
      targetId: documentId,
      details: { status: "APPROVED" },
    });

    return { success: true, document: updated };
  },

  async rejectDriverDocument(documentId: string, reason?: string, adminUserId?: string) {
    ensureObjectId(documentId, "documentId");
    const updated = await DriverDocumentService.rejectDocument(documentId, reason);
    if (!updated) {
      throw new AdminBackofficeError(404, "NOT_FOUND", "Documento não encontrado.");
    }

    await this.recordAudit({
      adminUserId,
      action: "DRIVER_DOCUMENT_REJECT",
      targetType: "driver_document",
      targetId: documentId,
      details: { status: "REJECTED", reason: reason || null },
    });

    return { success: true, document: updated };
  },

  async batchApproveDriverDocuments(ids: string[], adminUserId?: string) {
    if (!Array.isArray(ids) || !ids.length) {
      throw new AdminBackofficeError(422, "VALIDATION_ERROR", "IDs são obrigatórios.");
    }
    const results = await Promise.all(ids.map((id) => adminBackofficeService.approveDriverDocument(id, adminUserId)));
    return { success: true, count: results.length };
  },

  async batchRejectDriverDocuments(ids: string[], reason?: string, adminUserId?: string) {
    if (!Array.isArray(ids) || !ids.length) {
      throw new AdminBackofficeError(422, "VALIDATION_ERROR", "IDs são obrigatórios.");
    }
    const results = await Promise.all(
      ids.map((id) => adminBackofficeService.rejectDriverDocument(id, reason, adminUserId)),
    );
    return { success: true, count: results.length };
  },

  async listVehicles(input: {
    page?: number;
    limit?: number;
    status?: string;
    userId?: string;
  }) {
    const page = Math.max(1, Number(input.page || 1));
    const limit = Math.min(100, Math.max(1, Number(input.limit || 20)));
    const filter: Record<string, unknown> = {};
    if (input.status) filter.status = input.status;
    if (input.userId) filter.userId = input.userId;

    const { vehicles, total } = await VehicleService.listVehicles(filter, page, limit);
    const ownerIds = vehicles
      .map((vehicle: any) => String(vehicle.userId))
      .filter(Boolean);
    const owners = await User.find({ _id: { $in: ownerIds } })
      .select("name phone email")
      .lean();
    const ownerMap = new Map(owners.map((owner: any) => [String(owner._id), owner]));

    return {
      success: true,
      data: {
        vehicles: vehicles.map((vehicle: any) => ({
          ...vehicle,
          owner: ownerMap.has(String(vehicle.userId))
            ? {
                id: String(vehicle.userId),
                name: ownerMap.get(String(vehicle.userId))?.name || null,
                phone: ownerMap.get(String(vehicle.userId))?.phone || null,
                email: ownerMap.get(String(vehicle.userId))?.email || null,
              }
            : null,
        })),
        total,
        page,
        limit,
      },
    };
  },

  async approveVehicle(vehicleId: string, adminUserId?: string) {
    ensureObjectId(vehicleId, "vehicleId");
    const updated = await VehicleService.approveVehicle(vehicleId, adminUserId);
    if (!updated) {
      throw new AdminBackofficeError(404, "NOT_FOUND", "Veículo não encontrado.");
    }

    await this.recordAudit({
      adminUserId,
      action: "VEHICLE_APPROVE",
      targetType: "vehicle",
      targetId: vehicleId,
      details: { status: "APPROVED" },
    });

    return { success: true, vehicle: updated };
  },

  async rejectVehicle(vehicleId: string, adminUserId?: string) {
    ensureObjectId(vehicleId, "vehicleId");
    const updated = await VehicleService.rejectVehicle(vehicleId);
    if (!updated) {
      throw new AdminBackofficeError(404, "NOT_FOUND", "Veículo não encontrado.");
    }

    await this.recordAudit({
      adminUserId,
      action: "VEHICLE_REJECT",
      targetType: "vehicle",
      targetId: vehicleId,
      details: { status: "REJECTED" },
    });

    return { success: true, vehicle: updated };
  },

  async batchApproveVehicles(ids: string[], adminUserId?: string) {
    if (!Array.isArray(ids) || !ids.length) {
      throw new AdminBackofficeError(422, "VALIDATION_ERROR", "IDs são obrigatórios.");
    }
    const results = await Promise.all(ids.map((id) => adminBackofficeService.approveVehicle(id, adminUserId)));
    return { success: true, count: results.length };
  },

  async batchRejectVehicles(ids: string[], adminUserId?: string) {
    if (!Array.isArray(ids) || !ids.length) {
      throw new AdminBackofficeError(422, "VALIDATION_ERROR", "IDs são obrigatórios.");
    }
    const results = await Promise.all(ids.map((id) => adminBackofficeService.rejectVehicle(id, adminUserId)));
    return { success: true, count: results.length };
  },

  async blockUser(userId: string, adminUserId?: string) {
    ensureObjectId(userId, "userId");
    const user = await User.findByIdAndUpdate(
      userId,
      { authStatus: "BLOCKED" },
      { new: true },
    );

    if (!user) {
      throw new AdminBackofficeError(404, "NOT_FOUND", "Usuário não encontrado.");
    }

    await this.recordAudit({
      adminUserId,
      action: "USER_BLOCK",
      targetType: "user",
      targetId: userId,
      details: { authStatus: "BLOCKED" },
    });

    return { success: true, user };
  },

  async unblockUser(userId: string, adminUserId?: string) {
    ensureObjectId(userId, "userId");
    let user = null;

    try {
      user = await User.findByIdAndUpdate(
        userId,
        { authStatus: "ACTIVE" },
        { new: true },
      );
    } catch (error) {
      console.error("[adminBackofficeService.unblockUser] failed to update user", {
        userId,
        adminUserId,
        error: toLoggableError(error),
      });
      throw error;
    }

    if (!user) {
      console.warn("[adminBackofficeService.unblockUser] user not found", {
        userId,
        adminUserId,
      });
      throw new AdminBackofficeError(
        404,
        "NOT_FOUND",
        "Usuário não encontrado.",
        { userId },
      );
    }

    await this.recordAudit({
      adminUserId,
      action: "USER_UNBLOCK",
      targetType: "user",
      targetId: userId,
      details: { authStatus: "ACTIVE" },
    });

    return { success: true, user };
  },

  async resetDriverOnboarding(userId: string, adminUserId?: string) {
    ensureObjectId(userId, "userId");

    const user = await User.findById(userId);
    if (!user) {
      throw new AdminBackofficeError(404, "NOT_FOUND", "Usuário não encontrado.");
    }

    if (user.role !== "driver") {
      throw new AdminBackofficeError(
        422,
        "VALIDATION_ERROR",
        "Reset de onboarding disponível apenas para motoristas.",
      );
    }

    await Promise.all([
      DriverDocument.updateMany(
        { user: user._id },
        {
          $set: {
            status: "PENDING",
            reviewedAt: null,
            rejectionReason: null,
          },
          $unset: {
            approvedBy: "",
            approvedAt: "",
          },
        },
      ),
      Vehicle.updateMany(
        { userId: user._id },
        {
          $set: {
            status: "PENDING",
            documentationStatus: "PENDING",
            activationStatus: "INACTIVE",
            approvedAt: null,
          },
          $unset: {
            approvedBy: "",
          },
        },
      ),
      VehiclePhoto.updateMany(
        { user: user._id },
        {
          $set: {
            status: "PENDING",
            reviewedAt: null,
            rejectionReason: null,
          },
        },
      ),
    ]);

    await this.recordAudit({
      adminUserId,
      action: "DRIVER_ONBOARDING_RESET",
      targetType: "user",
      targetId: userId,
      details: { onboardingStatus: "PENDING" },
    });

    return { success: true, message: "Onboarding resetado com sucesso." };
  },

  async getAuditLogs(input: {
    page?: number;
    limit?: number;
    action?: string;
    targetType?: string;
  }) {
    const page = Math.max(1, Number(input.page || 1));
    const limit = Math.min(100, Math.max(1, Number(input.limit || 20)));
    const filter: Record<string, unknown> = {};
    if (input.action) filter.action = input.action;
    if (input.targetType) filter.targetType = input.targetType;

    const [logs, total] = await Promise.all([
      AdminAuditLog.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("adminUserId", "name email")
        .lean(),
      AdminAuditLog.countDocuments(filter),
    ]);

    return {
      success: true,
      data: {
        logs: logs.map((log: any) => ({
          id: String(log._id),
          action: log.action,
          targetType: log.targetType,
          targetId: log.targetId || null,
          details: log.details || {},
          createdAt: log.createdAt,
          adminUser: log.adminUserId
            ? {
                id: String(log.adminUserId._id),
                name: log.adminUserId.name || null,
                email: log.adminUserId.email || null,
              }
            : null,
        })),
        total,
        page,
        limit,
      },
    };
  },

  async logTarifaAction(input: {
    adminUserId?: string;
    action: string;
    tarifaId?: string;
    details?: Record<string, unknown>;
  }) {
    await this.recordAudit({
      adminUserId: input.adminUserId,
      action: input.action,
      targetType: "tarifa",
      targetId: input.tarifaId,
      details: input.details,
    });
  },
};

export { AdminBackofficeError };
