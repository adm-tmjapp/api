import mongoose from "mongoose";
import admin from "../../config/firebase";
import PassengerNotification from "../../models/PassengerNotification";
import PassengerPaymentMethod from "../../models/PassengerPaymentMethod";
import Payment from "../../models/Payment";
import Ride from "../../models/Ride";
import RideLocationSnapshot from "../../models/RideLocationSnapshot";
import User from "../../models/User";
import { calculateDistanceAndDuration, getAvailableProducts } from "../../services/routeService";
import DriverDocumentService from "../../services/driverDocumentService";
import { rideMatchingService } from "./rideMatchingService";

type ServiceErrorCode =
  | "PASSENGER_NOT_FOUND"
  | "RIDE_NOT_FOUND"
  | "RIDE_NOT_OWNED"
  | "RIDE_NOT_CANCELABLE"
  | "VALIDATION_ERROR"
  | "PAYMENT_METHOD_NOT_FOUND"
  | "INVALID_RIDE_ID"
  | "FIREBASE_TOKEN_ERROR";

type AddressInput = {
  street?: string;
  number?: string;
  district?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  complement?: string;
  latitude?: number;
  longitude?: number;
  formattedAddress?: string;
};

type PaymentMethodInput = {
  type?: string;
  brand?: string;
  last4?: string;
  holderName?: string;
  label?: string;
  isDefault?: boolean;
};

export class PassengerAppServiceError extends Error {
  statusCode: number;

  code: ServiceErrorCode;

  details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: ServiceErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function normalizeDateTime(value?: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toObjectId(value: string) {
  return new mongoose.Types.ObjectId(value);
}

function ensureObjectId(value: string, message = "ID inválido.") {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new PassengerAppServiceError(422, "VALIDATION_ERROR", message);
  }
}

function getFirebaseDatabaseUrl(): string {
  return (
    process.env.FIREBASE_DATABASE_URL ||
    process.env.FIREBASE_DB_URL ||
    ""
  ).trim();
}

function mapRideStatus(status?: string) {
  return String(status || "pending").toLowerCase();
}

function buildRideDetailPayload(ride: any) {
  return {
    id: String(ride._id),
    status: mapRideStatus(ride.status),
    requested_at: normalizeDateTime(ride.requestedAt),
    accepted_at: normalizeDateTime(ride.acceptedAt),
    picked_up_at: normalizeDateTime(ride.pickedUpAt),
    completed_at: normalizeDateTime(ride.completedAt),
    driver: ride.driver || null,
    vehicle: ride.vehicle || null,
    pickup_location: ride.pickup_location || null,
    destination_location: ride.destination_location || null,
    product: ride.product || null,
    payment_method: ride.payment_method || null,
    fare: ride.fare || null,
    route: ride.route || null,
  };
}

function buildAddressPayload(address?: any) {
  return {
    street: address?.street || null,
    number: address?.number || null,
    district: address?.district || null,
    city: address?.city || null,
    state: address?.state || null,
    zipCode: address?.zipCode || null,
    complement: address?.complement || null,
    latitude: typeof address?.latitude === "number" ? address.latitude : null,
    longitude: typeof address?.longitude === "number" ? address.longitude : null,
    formattedAddress: address?.formattedAddress || null,
  };
}

function applyRideCheckoutData(rideDoc: any, body: any, ride?: any) {
  rideDoc.product = body?.product || null;
  rideDoc.payment_method = body?.payment_method || null;
  rideDoc.status = "pending";

  const selectedPrice = Number(body?.product?.price ?? 0);
  if (Number.isFinite(selectedPrice) && selectedPrice > 0) {
    rideDoc.fare = {
      currency: "BRL",
      total_amount: selectedPrice,
      breakdown: {
        base_fare: Number(body?.product?.fare_breakdown?.valorBase || 0),
        distance_fee: Number(body?.product?.fare_breakdown?.valorKm || 0),
        time_fee: Number(body?.route?.duration_min || ride?.route?.duration_min || 0),
        service_fee: Number(body?.product?.fare_breakdown?.valorTaxa || 0),
      },
    };
  }
}

async function buildDispatchPayload(rideDoc: any) {
  let dispatch: Record<string, unknown> | null = null;
  try {
    dispatch = await rideMatchingService.startDispatch(String(rideDoc._id));
  } catch (error) {
    console.error("[passengerAppService.buildDispatchPayload] failed to dispatch ride", {
      rideId: String(rideDoc?._id || ""),
      error: (error as Error)?.message || String(error),
    });
    dispatch = {
      success: false,
      code: "DISPATCH_FAILED",
    };
  }

  return dispatch;
}

function validateAddressInput(input: AddressInput) {
  const requiredFields: Array<keyof AddressInput> = [
    "street",
    "district",
    "city",
    "state",
    "zipCode",
    "latitude",
    "longitude",
    "formattedAddress",
  ];

  const missing = requiredFields.filter((field) => {
    const value = input[field];
    if (typeof value === "number") return Number.isNaN(value);
    return value === undefined || value === null || String(value).trim() === "";
  });

  if (missing.length) {
    throw new PassengerAppServiceError(
      422,
      "VALIDATION_ERROR",
      "Endereco invalido.",
      { missingFields: missing },
    );
  }
}

async function ensurePassenger(passengerUserId: string) {
  ensureObjectId(passengerUserId, "Usuário inválido.");
  const user = await User.findById(passengerUserId);
  if (!user || user.role !== "passenger") {
    throw new PassengerAppServiceError(
      404,
      "PASSENGER_NOT_FOUND",
      "Passageiro não encontrado.",
    );
  }
  return user;
}

async function ensurePassengerRide(rideId: string, passengerUserId: string) {
  if (!mongoose.Types.ObjectId.isValid(rideId)) {
    throw new PassengerAppServiceError(422, "INVALID_RIDE_ID", "Ride ID inválido.");
  }

  const ride = await Ride.findById(rideId).lean();
  if (!ride) {
    throw new PassengerAppServiceError(404, "RIDE_NOT_FOUND", "Corrida não encontrada.");
  }

  const ridePassengerId = String((ride as any).passengerId || (ride as any)?.rider?.id || "");
  if (!ridePassengerId || ridePassengerId !== passengerUserId) {
    throw new PassengerAppServiceError(
      403,
      "RIDE_NOT_OWNED",
      "Corrida não pertence ao passageiro autenticado.",
    );
  }

  return ride;
}

async function ensureDefaultPaymentMethod(passengerUserId: string) {
  const count = await PassengerPaymentMethod.countDocuments({
    passengerUserId: toObjectId(passengerUserId),
  });

  if (!count) {
    await PassengerPaymentMethod.create({
      passengerUserId: toObjectId(passengerUserId),
      type: "pix",
      label: "PIX",
      isDefault: true,
    });
  }
}

async function ensurePassengerNotificationsSeed(passengerUserId: string) {
  const existing = await PassengerNotification.countDocuments({
    passengerUserId: toObjectId(passengerUserId),
  });

  if (!existing) {
    await PassengerNotification.insertMany([
      {
        passengerUserId: toObjectId(passengerUserId),
        title: "Motorista a caminho",
        body: "Seu motorista chegará em alguns minutos.",
        read: false,
      },
      {
        passengerUserId: toObjectId(passengerUserId),
        title: "Pagamento confirmado",
        body: "Seu último pagamento foi processado com sucesso.",
        read: true,
      },
    ]);
  }
}

export const passengerAppService = {
  async createRide(passengerUserId: string, body: any) {
    await ensurePassenger(passengerUserId);

    const pickupLocation = body?.pickup_location;
    const destinationLocation = body?.destination_location;

    if (
      !pickupLocation?.coordinates ||
      !destinationLocation?.coordinates ||
      typeof pickupLocation.coordinates.latitude !== "number" ||
      typeof pickupLocation.coordinates.longitude !== "number" ||
      typeof destinationLocation.coordinates.latitude !== "number" ||
      typeof destinationLocation.coordinates.longitude !== "number"
    ) {
      throw new PassengerAppServiceError(
        422,
        "VALIDATION_ERROR",
        "Origem e destino são obrigatórios.",
      );
    }

    const route = calculateDistanceAndDuration(
      pickupLocation.coordinates,
      destinationLocation.coordinates,
    );

    const products = await getAvailableProducts(route.distance_km);

    const ride = await Ride.create({
      passengerId: passengerUserId,
      rider: { id: passengerUserId },
      pickup_location: pickupLocation,
      destination_location: destinationLocation,
      status: "pending",
      fare: {
        currency: "BRL",
        total_amount: 0,
      },
      route,
      requestedAt: new Date(),
    });

    let dispatch: Record<string, unknown> | null = null;
    const shouldDispatchOnCreate = !!body?.product && !!body?.payment_method;
    if (shouldDispatchOnCreate) {
      applyRideCheckoutData(ride, body);
      await ride.save();
      dispatch = await buildDispatchPayload(ride);
    }

    return {
      ride: {
        id: String(ride._id),
        status: ride.status,
        requested_at: normalizeDateTime(ride.requestedAt),
        pickup_location: ride.pickup_location,
        destination_location: ride.destination_location,
        route: ride.route,
      },
      products,
      dispatch,
    };
  },

  async checkoutRide(passengerUserId: string, rideId: string, body: any) {
    const ride: any = await ensurePassengerRide(rideId, passengerUserId);
    const rideDoc: any = await Ride.findById(rideId);

    if (!rideDoc) {
      throw new PassengerAppServiceError(404, "RIDE_NOT_FOUND", "Corrida não encontrada.");
    }

    applyRideCheckoutData(rideDoc, body, ride);

    await rideDoc.save();
    const dispatch = await buildDispatchPayload(rideDoc);

    return {
      message: "Produto e método de pagamento atualizados com sucesso",
      ride: buildRideDetailPayload(rideDoc.toObject()),
      dispatch,
    };
  },

  async listRides(passengerUserId: string, status?: string) {
    await ensurePassenger(passengerUserId);

    const query: any = {
      $or: [{ passengerId: passengerUserId }, { "rider.id": passengerUserId }],
    };

    if (status) {
      query.status = status;
    }

    const rides = await Ride.find(query).sort({ requestedAt: -1 }).lean();
    return rides.map((ride) => buildRideDetailPayload(ride));
  },

  async getRide(passengerUserId: string, rideId: string) {
    const ride = await ensurePassengerRide(rideId, passengerUserId);
    return buildRideDetailPayload(ride);
  },

  async getRideStatus(passengerUserId: string, rideId: string) {
    const ride: any = await ensurePassengerRide(rideId, passengerUserId);
    return {
      rideId: String(ride._id),
      status: mapRideStatus(ride.status),
      updatedAt: normalizeDateTime(ride.updatedAt || ride.completedAt || ride.acceptedAt || ride.requestedAt),
    };
  },

  async cancelRide(passengerUserId: string, rideId: string, reason?: string) {
    const ride: any = await ensurePassengerRide(rideId, passengerUserId);

    if (!["pending", "accepted"].includes(String(ride.status || "").toLowerCase())) {
      throw new PassengerAppServiceError(
        422,
        "RIDE_NOT_CANCELABLE",
        "Corrida não pode ser cancelada no status atual.",
      );
    }

    const updatedRide = await Ride.findByIdAndUpdate(
      rideId,
      {
        status: "canceled",
        notes: reason || undefined,
      },
      { new: true },
    ).lean();

    return {
      message: "Corrida cancelada com sucesso",
      ride: {
        id: String(updatedRide?._id),
        status: mapRideStatus(updatedRide?.status),
      },
    };
  },

  async issueRealtimeToken(passengerUserId: string, rideId: string) {
    await ensurePassengerRide(rideId, passengerUserId);
    const expiresAt = new Date(Date.now() + 60 * 60000);
    const claims = {
      role: "passenger",
      rideId,
      canRead: true,
      canWrite: ["passenger_location", "presence"],
      tokenExpiresAt: expiresAt.toISOString(),
    };

    try {
      const token = await admin.auth().createCustomToken(passengerUserId, claims);
      return {
        success: true,
        firebase: {
          dbUrl: getFirebaseDatabaseUrl(),
          customToken: token,
          expiresAt: expiresAt.toISOString(),
          rideId,
          role: "passenger",
        },
      };
    } catch (_error) {
      throw new PassengerAppServiceError(
        500,
        "FIREBASE_TOKEN_ERROR",
        "Falha ao gerar token realtime do passageiro.",
      );
    }
  },

  async getRideEta(passengerUserId: string, rideId: string) {
    const ride: any = await ensurePassengerRide(rideId, passengerUserId);
    const driverUserId = String(ride?.driver?.id || "");
    if (!driverUserId) {
      return {
        rideId,
        status: mapRideStatus(ride.status),
        eta: null,
      };
    }

    const latestSnapshot = await RideLocationSnapshot.findOne({
      rideId,
      driverUserId,
    })
      .sort({ capturedAt: -1 })
      .lean();

    if (!latestSnapshot) {
      return {
        rideId,
        status: mapRideStatus(ride.status),
        eta: null,
      };
    }

    return {
      rideId,
      status: mapRideStatus(ride.status),
      driverLocation: {
        lat: latestSnapshot.lat,
        lng: latestSnapshot.lng,
        capturedAt: normalizeDateTime(latestSnapshot.capturedAt),
      },
    };
  },

  async createPayment(passengerUserId: string, body: any) {
    await ensurePassenger(passengerUserId);

    const rideId = body?.rideId;
    const amount = Number(body?.amount);
    const paymentMethod = String(body?.paymentMethod || "").trim();

    if (!rideId || !Number.isFinite(amount) || amount <= 0 || !paymentMethod) {
      throw new PassengerAppServiceError(
        422,
        "VALIDATION_ERROR",
        "Dados de pagamento inválidos.",
      );
    }

    const payment = await Payment.create({
      rideId,
      passengerId: passengerUserId,
      driverId: body?.driverId,
      amount,
      status: "pending",
      paymentMethod,
    });

    return payment;
  },

  async listPaymentMethods(passengerUserId: string) {
    await ensurePassenger(passengerUserId);
    await ensureDefaultPaymentMethod(passengerUserId);

    const methods = await PassengerPaymentMethod.find({
      passengerUserId: toObjectId(passengerUserId),
    })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean();

    return {
      methods: methods.map((method) => ({
        id: String(method._id),
        type: method.type,
        provider: method.provider || null,
        brand: method.brand || null,
        last4: method.last4 || null,
        holderName: method.holderName || null,
        label: method.label || null,
        isDefault: !!method.isDefault,
        status: method.status || "ACTIVE",
      })),
    };
  },

  async createPaymentMethod(passengerUserId: string, input: PaymentMethodInput) {
    await ensurePassenger(passengerUserId);

    const type = String(input.type || "").trim().toLowerCase();
    if (!["card", "pix"].includes(type)) {
      throw new PassengerAppServiceError(
        422,
        "VALIDATION_ERROR",
        "Tipo de método de pagamento inválido.",
      );
    }

    const payload: any = {
      passengerUserId: toObjectId(passengerUserId),
      type,
      brand: input.brand?.trim() || undefined,
      last4: input.last4?.trim() || undefined,
      holderName: input.holderName?.trim() || undefined,
      label: input.label?.trim() || (type === "pix" ? "PIX" : undefined),
      isDefault: !!input.isDefault,
    };

    if (type === "card" && (!payload.brand || !payload.last4)) {
      throw new PassengerAppServiceError(
        422,
        "VALIDATION_ERROR",
        "brand e last4 são obrigatórios para cartão.",
      );
    }

    if (payload.isDefault) {
      await PassengerPaymentMethod.updateMany(
        { passengerUserId: toObjectId(passengerUserId) },
        { $set: { isDefault: false } },
      );
    }

    const method = await PassengerPaymentMethod.create(payload);

    if (!(await PassengerPaymentMethod.countDocuments({ passengerUserId: toObjectId(passengerUserId), isDefault: true }))) {
      method.isDefault = true;
      await method.save();
    }

    return {
      id: String(method._id),
      type: method.type,
      provider: method.provider || null,
      brand: method.brand || null,
      last4: method.last4 || null,
      holderName: method.holderName || null,
      label: method.label || null,
      isDefault: !!method.isDefault,
      status: method.status || "ACTIVE",
    };
  },

  async deletePaymentMethod(passengerUserId: string, methodId: string) {
    ensureObjectId(methodId, "Método de pagamento inválido.");

    const method = await PassengerPaymentMethod.findOneAndDelete({
      _id: methodId,
      passengerUserId: toObjectId(passengerUserId),
    });

    if (!method) {
      throw new PassengerAppServiceError(
        404,
        "PAYMENT_METHOD_NOT_FOUND",
        "Método de pagamento não encontrado.",
      );
    }

    if (method.isDefault) {
      const fallback = await PassengerPaymentMethod.findOne({
        passengerUserId: toObjectId(passengerUserId),
      }).sort({ createdAt: -1 });

      if (fallback) {
        fallback.isDefault = true;
        await fallback.save();
      }
    }

    return {
      success: true,
      message: "Método de pagamento removido com sucesso.",
    };
  },

  async setDefaultPaymentMethod(passengerUserId: string, methodId: string) {
    ensureObjectId(methodId, "Método de pagamento inválido.");

    const method = await PassengerPaymentMethod.findOne({
      _id: methodId,
      passengerUserId: toObjectId(passengerUserId),
    });

    if (!method) {
      throw new PassengerAppServiceError(
        404,
        "PAYMENT_METHOD_NOT_FOUND",
        "Método de pagamento não encontrado.",
      );
    }

    await PassengerPaymentMethod.updateMany(
      { passengerUserId: toObjectId(passengerUserId) },
      { $set: { isDefault: false } },
    );

    method.isDefault = true;
    await method.save();

    return {
      success: true,
      message: "Método de pagamento padrão atualizado com sucesso.",
    };
  },

  async uploadProfilePhoto(passengerUserId: string, file: any) {
    await ensurePassenger(passengerUserId);

    if (!file) {
      throw new PassengerAppServiceError(
        422,
        "VALIDATION_ERROR",
        "Arquivo é obrigatório.",
      );
    }

    const fileUrl = await DriverDocumentService.uploadFile(file, passengerUserId);
    await User.findByIdAndUpdate(passengerUserId, { profilePhoto: fileUrl });

    return {
      message: "Foto atualizada com sucesso",
      photoUrl: fileUrl,
    };
  },

  async getAddress(passengerUserId: string) {
    const user = await ensurePassenger(passengerUserId);
    return buildAddressPayload((user as any).toObject?.().address || (user as any).address);
  },

  async updateAddress(passengerUserId: string, input: AddressInput) {
    await ensurePassenger(passengerUserId);
    validateAddressInput(input);

    await User.findByIdAndUpdate(passengerUserId, {
      $set: {
        address: {
          street: input.street?.trim(),
          number: input.number?.trim() || null,
          district: input.district?.trim(),
          city: input.city?.trim(),
          state: input.state?.trim(),
          zipCode: input.zipCode?.trim(),
          complement: input.complement?.trim() || null,
          latitude: Number(input.latitude),
          longitude: Number(input.longitude),
          formattedAddress: input.formattedAddress?.trim(),
        },
      },
    });

    return {
      success: true,
      message: "Endereco atualizado com sucesso.",
    };
  },

  async getAddressHistory(passengerUserId: string) {
    const user = await ensurePassenger(passengerUserId);
    const history = Array.isArray((user as any).addressHistory)
      ? [...((user as any).addressHistory as any[])].sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
        )
      : [];

    return {
      data: history.map((entry: any) => ({
        id: String(entry._id),
        label: entry.label || null,
        formattedAddress: entry.formattedAddress,
      })),
    };
  },

  async saveAddressHistory(passengerUserId: string, input: AddressInput & { label?: string }) {
    await ensurePassenger(passengerUserId);
    validateAddressInput(input);

    const nextEntry = {
      label: input.label?.trim() || null,
      street: input.street?.trim(),
      number: input.number?.trim() || null,
      district: input.district?.trim(),
      city: input.city?.trim(),
      state: input.state?.trim(),
      zipCode: input.zipCode?.trim(),
      complement: input.complement?.trim() || null,
      latitude: Number(input.latitude),
      longitude: Number(input.longitude),
      formattedAddress: input.formattedAddress?.trim(),
      createdAt: new Date(),
    };

    const user = await User.findById(passengerUserId);
    if (!user) {
      throw new PassengerAppServiceError(404, "PASSENGER_NOT_FOUND", "Passageiro não encontrado.");
    }

    const currentHistory = Array.isArray((user as any).addressHistory)
      ? ((user as any).addressHistory as any[]).map((entry) => ({
          ...entry.toObject?.() || entry,
        }))
      : [];

    const filtered = currentHistory.filter((entry) => {
      const sameAddress = String(entry.formattedAddress || "").trim() === nextEntry.formattedAddress;
      const sameCoordinates =
        Number(entry.latitude) === nextEntry.latitude &&
        Number(entry.longitude) === nextEntry.longitude;
      return !(sameAddress && sameCoordinates);
    });

    (user as any).addressHistory = [nextEntry, ...filtered].slice(0, 10);
    await user.save();

    return {
      success: true,
      message: "Endereco salvo com sucesso.",
    };
  },

  async getOnboardingStatus(passengerUserId: string) {
    const user = await ensurePassenger(passengerUserId);
    return {
      isCompleted: !!user.emailVerified && !!user.phoneVerified,
      isUnderReview: false,
      canUseApp: user.authStatus === "ACTIVE",
      steps: {
        email: { completed: !!user.emailVerified },
        phone: { completed: !!user.phoneVerified },
        profile: { completed: !!user.name && !!user.email && !!user.phone },
      },
    };
  },

  async listNotifications(passengerUserId: string) {
    await ensurePassenger(passengerUserId);
    await ensurePassengerNotificationsSeed(passengerUserId);

    const items = await PassengerNotification.find({
      passengerUserId: toObjectId(passengerUserId),
    })
      .sort({ createdAt: -1 })
      .lean();

    const unreadCount = items.filter((item) => !item.read).length;

    return {
      items: items.map((item) => ({
        id: String(item._id),
        title: item.title,
        body: item.body,
        read: !!item.read,
        createdAt: normalizeDateTime(item.createdAt),
      })),
      unreadCount,
    };
  },

  async markNotificationRead(passengerUserId: string, notificationId: string) {
    ensureObjectId(notificationId, "Notificação inválida.");

    await PassengerNotification.findOneAndUpdate(
      {
        _id: notificationId,
        passengerUserId: toObjectId(passengerUserId),
      },
      { $set: { read: true } },
    );

    return {
      success: true,
      message: "Notificação marcada como lida.",
    };
  },

  async markAllNotificationsRead(passengerUserId: string) {
    await PassengerNotification.updateMany(
      { passengerUserId: toObjectId(passengerUserId), read: false },
      { $set: { read: true } },
    );

    return {
      success: true,
      message: "Todas as notificações foram marcadas como lidas.",
    };
  },

  getSupportContact() {
    return {
      channel: String(process.env.SUPPORT_CONTACT_CHANNEL || "whatsapp").toLowerCase(),
      phone: process.env.SUPPORT_CONTACT_PHONE || null,
      whatsApp: process.env.SUPPORT_CONTACT_WHATSAPP || process.env.SUPPORT_CONTACT_PHONE || null,
      chatUrl: process.env.SUPPORT_CONTACT_URL || null,
      availability: process.env.SUPPORT_CONTACT_AVAILABILITY || "24x7",
    };
  },

  getPasswordResetDiagnostics() {
    return {
      smtpHost: process.env.MAIL_HOST || null,
      smtpPort: process.env.MAIL_PORT || null,
      mailFrom: process.env.MAIL_FROM || null,
      ready: !!process.env.MAIL_HOST && !!process.env.MAIL_PORT && !!process.env.MAIL_USER && !!process.env.MAIL_PASS,
    };
  },
};
