import mongoose from "mongoose";
import Driver from "../../models/Driver";
import DriverDocument from "../../models/DriverDocument";
import Ride from "../../models/Ride";
import User from "../../models/User";
import Vehicle from "../../models/Vehicle";

type DocumentStatus = "pending" | "approved" | "rejected";

type DriverProfileDocumentPayload = {
  status: DocumentStatus;
  url: string | null;
  fileName: string | null;
  uploadedAt: string | null;
  reviewedAt: string | null;
  reason: string | null;
};

type DriverProfileUpdateInput = {
  name?: string;
  email?: string;
  phone?: string;
  cpf?: string;
};

type DriverAddressInput = {
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

type DriverAddressHistoryInput = {
  label?: string;
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

type ServiceErrorCode =
  | "DRIVER_NOT_FOUND"
  | "VALIDATION_ERROR"
  | "EMAIL_ALREADY_IN_USE"
  | "PHONE_ALREADY_IN_USE";

export class DriverProfileServiceError extends Error {
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

function maskCpf(cpf?: string | null) {
  if (!cpf) return null;
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return null;
  return `***.***.***-${cleaned.slice(-2)}`;
}

function normalizeDocumentStatus(status?: string | null): DocumentStatus {
  if (status === "APPROVED") return "approved";
  if (status === "REJECTED") return "rejected";
  return "pending";
}

function isValidCpf(cpf: string) {
  const cleaned = cpf.replace(/\D/g, "");
  if (!/^\d{11}$/.test(cleaned)) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += Number(cleaned[i]) * (10 - i);
  }

  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== Number(cleaned[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) {
    sum += Number(cleaned[i]) * (11 - i);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  return remainder === Number(cleaned[10]);
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function normalizeDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function sanitizeOptionalString(value?: string | null) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function normalizeZipCode(zipCode?: string) {
  if (!zipCode) return undefined;
  const trimmed = zipCode.trim();
  return trimmed.length ? trimmed : undefined;
}

function getPartnerSince(driverDoc: any, userDoc: any) {
  if (driverDoc?.createdAt instanceof Date) {
    return normalizeDate(driverDoc.createdAt);
  }

  if (driverDoc?._id instanceof mongoose.Types.ObjectId) {
    return normalizeDate(driverDoc._id.getTimestamp());
  }

  return normalizeDate(userDoc.createdAt);
}

async function ensureDriverUser(driverUserId: string) {
  const [user, driver] = await Promise.all([
    User.findById(driverUserId),
    Driver.findOne({ userId: driverUserId }),
  ]);

  if (!user || user.role !== "driver") {
    throw new DriverProfileServiceError(
      404,
      "DRIVER_NOT_FOUND",
      "Motorista não encontrado.",
    );
  }

  return { user, driver };
}

async function countDriverRides(driverUserId: string) {
  return Ride.countDocuments({
    "driver.id": driverUserId,
    status: "completed",
  });
}

async function getDriverRating(driverUserId: string) {
  const rides = await Ride.find({
    "driver.id": driverUserId,
    status: "completed",
    "driver.rating": { $type: "number" },
  })
    .select("driver.rating")
    .lean();

  if (!rides.length) return null;

  const total = rides.reduce((acc: number, ride: any) => {
    const rating = typeof ride?.driver?.rating === "number" ? ride.driver.rating : 0;
    return acc + rating;
  }, 0);

  return Number((total / rides.length).toFixed(1));
}

async function getLatestDocument(
  userId: string,
  type: "CNH" | "SELFIE" | "RESIDENCE_PROOF" | "CRIMINAL_RECORD",
  side?: "FRONT" | "BACK",
) {
  const query: Record<string, unknown> = { user: userId, type };
  if (side) query.side = side;

  return DriverDocument.findOne(query).sort({ updatedAt: -1, createdAt: -1 }).lean();
}

function toIsoDateTime(value?: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function buildDocumentPayload(
  doc?: any,
  fallbackUrl?: string | null,
): DriverProfileDocumentPayload {
  if (!doc && !fallbackUrl) {
    return {
      status: "pending" as DocumentStatus,
      url: null,
      fileName: null,
      uploadedAt: null,
      reviewedAt: null,
      reason: null,
    };
  }

  return {
    status: normalizeDocumentStatus(doc?.status),
    url: doc?.fileUrl || fallbackUrl || null,
    fileName: doc?.filename || null,
    uploadedAt: toIsoDateTime(doc?.updatedAt || doc?.createdAt) || null,
    reviewedAt: toIsoDateTime(doc?.reviewedAt) || null,
    reason: doc?.rejectionReason || null,
  };
}

function emptyAddressPayload() {
  return {
    street: null,
    number: null,
    district: null,
    city: null,
    state: null,
    zipCode: null,
    complement: null,
    latitude: null,
    longitude: null,
    formattedAddress: null,
  };
}

function mapAddressPayload(address?: any) {
  if (!address) return emptyAddressPayload();

  return {
    street: address.street || null,
    number: address.number || null,
    district: address.district || null,
    city: address.city || null,
    state: address.state || null,
    zipCode: address.zipCode || null,
    complement: address.complement || null,
    latitude: typeof address.latitude === "number" ? address.latitude : null,
    longitude: typeof address.longitude === "number" ? address.longitude : null,
    formattedAddress: address.formattedAddress || null,
  };
}

function validateAddressInput(input: DriverAddressInput) {
  const payload = {
    street: sanitizeOptionalString(input.street),
    number: sanitizeOptionalString(input.number),
    district: sanitizeOptionalString(input.district),
    city: sanitizeOptionalString(input.city),
    state: sanitizeOptionalString(input.state)?.toUpperCase(),
    zipCode: normalizeZipCode(input.zipCode),
    complement: sanitizeOptionalString(input.complement),
    formattedAddress: sanitizeOptionalString(input.formattedAddress),
    latitude: input.latitude,
    longitude: input.longitude,
  };

  const requiredFields = [
    payload.street,
    payload.number,
    payload.district,
    payload.city,
    payload.state,
    payload.zipCode,
    payload.formattedAddress,
  ];

  if (requiredFields.some((value) => !value)) {
    throw new DriverProfileServiceError(
      422,
      "VALIDATION_ERROR",
      "Endereco invalido.",
    );
  }

  if (
    typeof payload.latitude !== "number" ||
    Number.isNaN(payload.latitude) ||
    typeof payload.longitude !== "number" ||
    Number.isNaN(payload.longitude)
  ) {
    throw new DriverProfileServiceError(
      422,
      "VALIDATION_ERROR",
      "Endereco invalido.",
      { field: "coordinates" },
    );
  }

  return payload;
}

export const driverProfileService = {
  async getProfile(driverUserId: string) {
    const [{ user, driver }, totalRides, rating] = await Promise.all([
      ensureDriverUser(driverUserId),
      countDriverRides(driverUserId),
      getDriverRating(driverUserId),
    ]);

    return {
      id: String(user._id),
      name: user.name,
      email: user.email,
      phone: user.phone,
      cpfMasked: maskCpf(user.cpf),
      profilePhotoUrl: user.profilePhoto || null,
      partnerSince: getPartnerSince(driver, user),
      rating,
      totalRides,
    };
  },

  async updateProfile(driverUserId: string, input: DriverProfileUpdateInput) {
    const { user } = await ensureDriverUser(driverUserId);

    const name = input.name?.trim();
    const email = input.email?.trim().toLowerCase();
    const rawPhone = input.phone?.trim();
    const phone = rawPhone ? normalizePhone(rawPhone) : undefined;
    const cpf = input.cpf ? input.cpf.replace(/\D/g, "") : undefined;

    if (!name || !email || !phone || !cpf) {
      throw new DriverProfileServiceError(
        422,
        "VALIDATION_ERROR",
        "name, email, phone e cpf são obrigatórios.",
      );
    }

    if (!isValidCpf(cpf)) {
      throw new DriverProfileServiceError(
        422,
        "VALIDATION_ERROR",
        "CPF inválido.",
        { field: "cpf" },
      );
    }

    const emailChanged = user.email !== email;
    const phoneChanged = user.phone !== phone;

    const [emailOwner, phoneOwner] = await Promise.all([
      emailChanged
        ? User.findOne({ email, _id: { $ne: user._id } }).select("_id")
        : null,
      phoneChanged
        ? User.findOne({ phone, _id: { $ne: user._id } }).select("_id")
        : null,
    ]);

    if (emailOwner) {
      throw new DriverProfileServiceError(
        409,
        "EMAIL_ALREADY_IN_USE",
        "E-mail já cadastrado por outro usuário.",
      );
    }

    if (phoneOwner) {
      throw new DriverProfileServiceError(
        409,
        "PHONE_ALREADY_IN_USE",
        "Telefone já cadastrado por outro usuário.",
      );
    }

    user.name = name;
    user.email = email;
    user.phone = phone;
    user.cpf = cpf;

    if (emailChanged) {
      user.emailVerified = false;
      user.emailValidation = undefined;
    }

    if (phoneChanged) {
      user.phoneVerified = true;
      user.phoneValidation = undefined;
    }

    if (user.emailVerified) {
      user.authStatus = "ACTIVE";
    } else {
      user.authStatus = "PENDING_EMAIL";
    }

    await user.save();

    return {
      success: true,
      message: "Perfil atualizado com sucesso.",
    };
  },

  async getActiveVehicle(driverUserId: string) {
    await ensureDriverUser(driverUserId);

    const vehicle =
      (await Vehicle.findOne({ userId: driverUserId, activationStatus: "ACTIVE" })
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean()) ||
      (await Vehicle.findOne({ userId: driverUserId, status: "APPROVED" })
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean()) ||
      (await Vehicle.findOne({ userId: driverUserId })
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean());

    if (!vehicle) {
      return null;
    }

    return {
      id: String(vehicle._id),
      manufacturer: vehicle.manufacturer,
      modelName: vehicle.modelName,
      year: vehicle.year || null,
      vehiclePlate: vehicle.vehiclePlate,
      color: vehicle.color,
      vehicleType: vehicle.vehicleType === "carro" ? "car" : "motorcycle",
    };
  },

  async getDocuments(driverUserId: string) {
    const { user } = await ensureDriverUser(driverUserId);

    const [cnhFront, cnhBack, selfie, residenceProof, criminalRecord] = await Promise.all([
      getLatestDocument(driverUserId, "CNH", "FRONT"),
      getLatestDocument(driverUserId, "CNH", "BACK"),
      getLatestDocument(driverUserId, "SELFIE"),
      getLatestDocument(driverUserId, "RESIDENCE_PROOF"),
      getLatestDocument(driverUserId, "CRIMINAL_RECORD"),
    ]);

    return {
      cnhFront: buildDocumentPayload(cnhFront),
      cnhBack: buildDocumentPayload(cnhBack),
      selfie: buildDocumentPayload(selfie),
      profilePhoto: buildDocumentPayload(
        user.profilePhoto
          ? {
              status: "APPROVED",
              fileUrl: user.profilePhoto,
              filename: user.profilePhoto.split("/").pop(),
              createdAt: user.createdAt,
              reviewedAt: user.createdAt,
            }
          : undefined,
        user.profilePhoto || null,
      ),
      residenceProof: buildDocumentPayload(residenceProof),
      criminalRecord: buildDocumentPayload(criminalRecord),
    };
  },

  async getAddress(driverUserId: string) {
    const { user } = await ensureDriverUser(driverUserId);
    return mapAddressPayload((user as any).address);
  },

  async updateAddress(driverUserId: string, input: DriverAddressInput) {
    const { user } = await ensureDriverUser(driverUserId);
    const address = validateAddressInput(input);

    (user as any).address = address;
    await user.save();

    return {
      success: true,
      message: "Endereco atualizado com sucesso.",
    };
  },

  async getAddressHistory(driverUserId: string) {
    const { user } = await ensureDriverUser(driverUserId);
    const items = [ ...(((user as any).addressHistory || []) as any[]) ]
      .sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      })
      .map((item) => ({
        id: String(item._id),
        label: item.label || null,
        formattedAddress: item.formattedAddress,
      }));

    return { data: items };
  },

  async saveAddressHistory(driverUserId: string, input: DriverAddressHistoryInput) {
    const { user } = await ensureDriverUser(driverUserId);

    const formattedAddress = sanitizeOptionalString(input.formattedAddress);
    const label = sanitizeOptionalString(input.label);
    const street = sanitizeOptionalString(input.street);
    const number = sanitizeOptionalString(input.number);
    const district = sanitizeOptionalString(input.district);
    const city = sanitizeOptionalString(input.city);
    const state = sanitizeOptionalString(input.state)?.toUpperCase();
    const zipCode = normalizeZipCode(input.zipCode);
    const complement = sanitizeOptionalString(input.complement);

    if (
      !formattedAddress ||
      typeof input.latitude !== "number" ||
      Number.isNaN(input.latitude) ||
      typeof input.longitude !== "number" ||
      Number.isNaN(input.longitude)
    ) {
      throw new DriverProfileServiceError(
        422,
        "VALIDATION_ERROR",
        "Endereco invalido.",
      );
    }

    const currentHistory = (((user as any).addressHistory || []) as any[]).filter(
      (item) =>
        item.formattedAddress !== formattedAddress ||
        Number(item.latitude) !== Number(input.latitude) ||
        Number(item.longitude) !== Number(input.longitude),
    );

    currentHistory.unshift({
      label,
      street,
      number,
      district,
      city,
      state,
      zipCode,
      complement,
      latitude: input.latitude,
      longitude: input.longitude,
      formattedAddress,
      createdAt: new Date(),
    });

    (user as any).addressHistory = currentHistory.slice(0, 10);
    await user.save();

    return {
      success: true,
      message: "Endereco salvo no historico com sucesso.",
    };
  },

  async getSecurity() {
    return {
      privacyPolicyUrl:
        process.env.PRIVACY_POLICY_URL || "https://tmjapp.com.br/privacy",
      termsUrl: process.env.TERMS_URL || "https://tmjapp.com.br/terms",
      appVersion: process.env.MOBILE_APP_VERSION || "1.5.0",
    };
  },
};
