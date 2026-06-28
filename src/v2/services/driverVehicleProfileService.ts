import mongoose from "mongoose";
import Driver from "../../models/Driver";
import DriverDocument from "../../models/DriverDocument";
import Vehicle from "../../models/Vehicle";
import VehiclePhoto from "../../models/VehiclePhoto";
import DriverDocumentService from "../../services/driverDocumentService";

type VehicleDocumentRequestType =
  | "CRLV"
  | "VEHICLE_FRONT"
  | "VEHICLE_BACK"
  | "VEHICLE_INTERIOR";
type VehicleRequestType = "car" | "motorcycle" | "pickup";

type ServiceErrorCode =
  | "DRIVER_NOT_FOUND"
  | "INVALID_VEHICLE_ID"
  | "VEHICLE_NOT_FOUND"
  | "VALIDATION_ERROR"
  | "DOCUMENTATION_PENDING"
  | "VEHICLE_BLOCKED"
  | "VEHICLE_CONFLICT";

type DocumentationStatus = "APPROVED" | "PENDING" | "REJECTED" | "UNDER_REVIEW";
type ActivationStatus = "ACTIVE" | "INACTIVE" | "BLOCKED";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
];

export class DriverVehicleProfileServiceError extends Error {
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

function normalizeVehicleTypeForResponse(vehicleType?: string | null): VehicleRequestType {
  const value = String(vehicleType || "").toLowerCase();
  if (value === "moto" || value === "motorcycle") return "motorcycle";
  if (value === "pickup") return "pickup";
  return "car";
}

function normalizeVehicleTypeForStorage(vehicleType: string) {
  const normalized = vehicleType.trim().toLowerCase();
  if (normalized === "car") return "carro";
  if (normalized === "motorcycle") return "moto";
  if (normalized === "pickup") return "pickup";
  throw new DriverVehicleProfileServiceError(
    422,
    "VALIDATION_ERROR",
    "vehicleType deve ser car, motorcycle ou pickup.",
    { field: "vehicleType" },
  );
}

function mapPhotoDocumentType(type: VehicleDocumentRequestType) {
  if (type === "VEHICLE_FRONT") return "FRONT";
  if (type === "VEHICLE_BACK") return "BACK";
  if (type === "VEHICLE_INTERIOR") return "INTERIOR";
  return null;
}

function toIsoDate(value?: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function validateUploadFile(file: any) {
  if (!file) {
    throw new DriverVehicleProfileServiceError(
      422,
      "VALIDATION_ERROR",
      "Arquivo é obrigatório.",
      { field: "file" },
    );
  }

  if (typeof file.size === "number" && file.size > MAX_FILE_SIZE_BYTES) {
    throw new DriverVehicleProfileServiceError(
      422,
      "VALIDATION_ERROR",
      "Arquivo excede o tamanho máximo permitido de 10MB.",
      { field: "file", maxSizeBytes: MAX_FILE_SIZE_BYTES },
    );
  }

  if (file.mimetype && !ALLOWED_MIME_TYPES.includes(String(file.mimetype).toLowerCase())) {
    throw new DriverVehicleProfileServiceError(
      422,
      "VALIDATION_ERROR",
      "Arquivo inválido ou tipo não suportado.",
      { field: "file", allowedMimeTypes: ALLOWED_MIME_TYPES },
    );
  }
}

async function ensureDriver(driverUserId: string) {
  const driver = await Driver.findOne({ userId: driverUserId }).lean();

  if (!driver) {
    throw new DriverVehicleProfileServiceError(
      404,
      "DRIVER_NOT_FOUND",
      "Motorista não encontrado.",
    );
  }

  return driver;
}

async function getDriverVehicleOrThrow(driverUserId: string, vehicleId: string) {
  if (!mongoose.Types.ObjectId.isValid(vehicleId)) {
    throw new DriverVehicleProfileServiceError(
      400,
      "INVALID_VEHICLE_ID",
      "Vehicle ID inválido.",
    );
  }

  const vehicle = await Vehicle.findOne({
    _id: vehicleId,
    userId: driverUserId,
  })
    .populate("photo")
    .populate("documents")
    .exec();

  if (!vehicle) {
    throw new DriverVehicleProfileServiceError(
      404,
      "VEHICLE_NOT_FOUND",
      "Veículo não encontrado.",
    );
  }

  return vehicle;
}

async function getVehiclePhotos(vehicleId: string) {
  return VehiclePhoto.find({ vehicle: vehicleId }).sort({ updatedAt: -1, createdAt: -1 }).lean();
}

function getPhotoUrl(vehicle: any, photos: any[]) {
  if (vehicle?.photo?.fileUrl) return vehicle.photo.fileUrl;
  return photos.find((photo) => photo.type === "FRONT")?.fileUrl || photos[0]?.fileUrl || null;
}

function deriveDocumentationStatus(vehicle: any, photos: any[]): DocumentationStatus {
  const docs = Array.isArray(vehicle?.documents) ? vehicle.documents : [];
  const crlv = docs.find((doc: any) => doc?.type === "CRLV");
  const front = photos.find((photo: any) => photo.type === "FRONT");
  const back = photos.find((photo: any) => photo.type === "BACK");
  const required = [crlv, front, back];

  const statuses = required
    .filter(Boolean)
    .map((item: any) => String(item.status || "PENDING").toUpperCase());

  if (!statuses.length) return "PENDING";
  if (statuses.includes("REJECTED")) return "REJECTED";

  const hasAllRequired = required.every(Boolean);
  const allApproved = hasAllRequired && statuses.every((status) => status === "APPROVED");

  if (allApproved) return "APPROVED";
  if (statuses.includes("PENDING")) return "UNDER_REVIEW";
  if (!hasAllRequired) return "PENDING";
  return "UNDER_REVIEW";
}

function deriveActivationStatus(vehicle: any, driver: any): ActivationStatus {
  const explicit = vehicle.activationStatus;
  if (explicit === "ACTIVE" || explicit === "INACTIVE" || explicit === "BLOCKED") {
    return explicit;
  }

  const driverPlate = String(driver?.vehicle?.plate || "").toUpperCase();
  const vehiclePlate = String(vehicle?.vehiclePlate || "").toUpperCase();

  if (driverPlate && driverPlate === vehiclePlate) {
    return "ACTIVE";
  }

  return "INACTIVE";
}

function toVehicleListItem(vehicle: any, driver: any, photos: any[]) {
  const documentationStatus =
    vehicle.documentationStatus || deriveDocumentationStatus(vehicle, photos);
  const activationStatus = deriveActivationStatus(vehicle, driver);

  return {
    id: String(vehicle._id),
    manufacturer: vehicle.manufacturer,
    modelName: vehicle.modelName,
    year: vehicle.year || null,
    vehiclePlate: vehicle.vehiclePlate,
    color: vehicle.color,
    vehicleType: normalizeVehicleTypeForResponse(vehicle.vehicleType),
    status: activationStatus,
    documentationStatus,
    photoUrl: getPhotoUrl(vehicle, photos),
  };
}

export const driverVehicleProfileService = {
  async listVehicles(driverUserId: string) {
    const driver = await ensureDriver(driverUserId);

    const vehicles = await Vehicle.find({ userId: driverUserId })
      .sort({ createdAt: -1, _id: -1 })
      .populate("photo")
      .populate("documents")
      .lean();

    const photoMap = new Map<string, any[]>();
    await Promise.all(
      vehicles.map(async (vehicle: any) => {
        photoMap.set(String(vehicle._id), await getVehiclePhotos(String(vehicle._id)));
      }),
    );

    return {
      data: vehicles.map((vehicle: any) =>
        toVehicleListItem(vehicle, driver, photoMap.get(String(vehicle._id)) || []),
      ),
    };
  },

  async activateVehicle(driverUserId: string, vehicleId: string) {
    const driver = await Driver.findOne({ userId: driverUserId }).exec();
    if (!driver) {
      throw new DriverVehicleProfileServiceError(
        404,
        "DRIVER_NOT_FOUND",
        "Motorista não encontrado.",
      );
    }

    const vehicle = await getDriverVehicleOrThrow(driverUserId, vehicleId);
    const photos = await getVehiclePhotos(String(vehicle._id));
    const documentationStatus = deriveDocumentationStatus(vehicle.toObject(), photos);
    const activationStatus = deriveActivationStatus(vehicle.toObject(), driver.toObject());

    if (activationStatus === "BLOCKED") {
      throw new DriverVehicleProfileServiceError(
        422,
        "VEHICLE_BLOCKED",
        "Veículo bloqueado para ativação.",
      );
    }

    if (documentationStatus !== "APPROVED") {
      throw new DriverVehicleProfileServiceError(
        422,
        "DOCUMENTATION_PENDING",
        "Documentação pendente para ativação.",
      );
    }

    await Promise.all([
      Vehicle.updateMany(
        { userId: driverUserId, _id: { $ne: vehicle._id }, activationStatus: { $ne: "BLOCKED" } },
        { $set: { activationStatus: "INACTIVE" } },
      ),
      Vehicle.findByIdAndUpdate(vehicle._id, {
        $set: {
          activationStatus: "ACTIVE",
          documentationStatus,
          status: documentationStatus === "APPROVED" ? "APPROVED" : vehicle.status,
        },
      }),
    ]);

    driver.vehicle = {
      make: vehicle.manufacturer,
      model: vehicle.modelName,
      year: Number(vehicle.year) || driver.vehicle?.year || 0,
      plate: vehicle.vehiclePlate,
    };
    await driver.save();

    return {
      success: true,
      message: "Veículo ativado com sucesso.",
    };
  },

  async getVehicleDocuments(driverUserId: string, vehicleId: string) {
    const vehicle = await getDriverVehicleOrThrow(driverUserId, vehicleId);
    const photos = await getVehiclePhotos(String(vehicle._id));
    const docs = Array.isArray(vehicle.documents) ? vehicle.documents : [];

    const payload = [
      ...docs
        .filter((doc: any) => doc?.type === "CRLV")
        .map((doc: any) => ({
          type: "CRLV",
          status: String(doc.status || "PENDING").toUpperCase(),
          url: doc.fileUrl || null,
          fileName: doc.filename || null,
          uploadedAt: toIsoDate(doc.createdAt || doc.updatedAt),
          reviewedAt: toIsoDate(doc.reviewedAt),
          reason: doc.rejectionReason || null,
        })),
      ...photos
        .filter(
          (photo: any) =>
            photo.type === "FRONT" ||
            photo.type === "BACK" ||
            photo.type === "INTERIOR",
        )
        .map((photo: any) => ({
          type:
            photo.type === "FRONT"
              ? "VEHICLE_FRONT"
              : photo.type === "BACK"
                ? "VEHICLE_BACK"
                : "VEHICLE_INTERIOR",
          status: String(photo.status || "PENDING").toUpperCase(),
          url: photo.fileUrl || null,
          fileName: photo.fileUrl ? String(photo.fileUrl).split("/").pop() || null : null,
          uploadedAt: toIsoDate(photo.createdAt || photo.updatedAt),
          reviewedAt: toIsoDate(photo.reviewedAt),
          reason: photo.rejectionReason || null,
        })),
    ];

    return {
      vehicleId: String(vehicle._id),
      documents: payload,
    };
  },

  async uploadVehicleDocument(
    driverUserId: string,
    vehicleId: string,
    type: VehicleDocumentRequestType,
    file: any,
  ) {
    const vehicle = await getDriverVehicleOrThrow(driverUserId, vehicleId);
    let uploadedUrl: string | null = null;

    validateUploadFile(file);

    if (
      !["CRLV", "VEHICLE_FRONT", "VEHICLE_BACK", "VEHICLE_INTERIOR"].includes(
        type,
      )
    ) {
      throw new DriverVehicleProfileServiceError(
        422,
        "VALIDATION_ERROR",
        "type deve ser CRLV, VEHICLE_FRONT, VEHICLE_BACK ou VEHICLE_INTERIOR.",
        { field: "type" },
      );
    }

    if (type === "CRLV") {
      const document = await DriverDocumentService.upsertDriverDocumentWithFile({
        userId: driverUserId,
        type: "CRLV",
        file,
      });

      const existingDocs = (vehicle.documents || []).map((doc: any) => String(doc));
      if (!existingDocs.includes(String(document._id))) {
        vehicle.documents = [
          ...(vehicle.documents || []),
          new mongoose.Types.ObjectId(String(document._id)),
        ];
      }
      vehicle.documentationStatus = "UNDER_REVIEW";
      vehicle.status = "PENDING";
      if (vehicle.activationStatus === "ACTIVE") {
        vehicle.activationStatus = "INACTIVE";
      }
      await vehicle.save();

      return {
        success: true,
        message: "Documento enviado com sucesso.",
        document: {
          type: "CRLV",
          status: "PENDING",
          url: document.fileUrl,
          fileName: document.filename || file.originalname || null,
          uploadedAt: toIsoDate(document.createdAt || new Date()),
        },
      };
    } else {
      const fileUrl = await DriverDocumentService.uploadFile(file, driverUserId);
      uploadedUrl = fileUrl;
      const photoType = mapPhotoDocumentType(type) as "FRONT" | "BACK" | "INTERIOR";

      const photo = await VehiclePhoto.findOneAndUpdate(
        {
          user: driverUserId,
          vehicle: vehicle._id,
          type: photoType,
        },
        {
          user: new mongoose.Types.ObjectId(driverUserId),
          vehicle: vehicle._id,
          type: photoType,
          fileUrl,
          status: "PENDING",
          rejectionReason: undefined,
          reviewedAt: undefined,
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        },
      ).exec();

      if (photoType === "FRONT") {
        vehicle.photo = photo._id as any;
      }
    }

    vehicle.documentationStatus = "UNDER_REVIEW";
    vehicle.status = "PENDING";
    if (vehicle.activationStatus === "ACTIVE") {
      vehicle.activationStatus = "INACTIVE";
    }
    await vehicle.save();

    return {
      success: true,
      message: "Documento enviado com sucesso.",
      document: {
        type,
        status: "PENDING",
        url: uploadedUrl,
        fileName: file.originalname || null,
        uploadedAt: toIsoDate(new Date()),
      },
    };
  },

  async uploadVehiclePhoto(driverUserId: string, vehicleId: string, file: any) {
    const vehicle = await getDriverVehicleOrThrow(driverUserId, vehicleId);
    validateUploadFile(file);

    const fileUrl = await DriverDocumentService.uploadFile(file, driverUserId);

    const photo = await VehiclePhoto.findOneAndUpdate(
      {
        user: driverUserId,
        vehicle: vehicle._id,
        type: "FRONT",
      },
      {
        user: new mongoose.Types.ObjectId(driverUserId),
        vehicle: vehicle._id,
        type: "FRONT",
        fileUrl,
        status: "PENDING",
        rejectionReason: undefined,
        reviewedAt: undefined,
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    ).exec();

    vehicle.photo = photo._id as any;
    if (vehicle.documentationStatus === "PENDING") {
      vehicle.documentationStatus = "UNDER_REVIEW";
    }
    await vehicle.save();

    return {
      success: true,
      photoUrl: fileUrl,
    };
  },

  async createVehicle(
    driverUserId: string,
    input: {
      manufacturer?: string;
      modelName?: string;
      year?: string;
      vehiclePlate?: string;
      color?: string;
      vehicleType?: string;
      renavam?: string;
    },
  ) {
    await ensureDriver(driverUserId);

    const manufacturer = input.manufacturer?.trim();
    const modelName = input.modelName?.trim();
    const year = input.year?.trim();
    const vehiclePlate = input.vehiclePlate?.trim().toUpperCase();
    const color = input.color?.trim();
    const vehicleType = input.vehicleType?.trim();
    const renavam = input.renavam?.trim();

    if (!manufacturer || !modelName || !year || !vehiclePlate || !color || !vehicleType) {
      throw new DriverVehicleProfileServiceError(
        422,
        "VALIDATION_ERROR",
        "manufacturer, modelName, year, vehiclePlate, color e vehicleType são obrigatórios.",
      );
    }

    const conflictConditions: Record<string, unknown>[] = [{ vehiclePlate }];

    if (renavam) {
      conflictConditions.push({ renavam });
    }

    const conflict = await Vehicle.findOne({
      $or: conflictConditions,
    })
      .select("_id")
      .lean();

    if (conflict) {
      throw new DriverVehicleProfileServiceError(
        409,
        "VEHICLE_CONFLICT",
        "Placa já cadastrada para outro usuário.",
      );
    }

    const vehicle = await Vehicle.create({
      userId: new mongoose.Types.ObjectId(driverUserId),
      manufacturer,
      modelName,
      year,
      vehiclePlate,
      renavam: renavam || undefined,
      color,
      vehicleType: normalizeVehicleTypeForStorage(vehicleType),
      status: "PENDING",
      documentationStatus: "PENDING",
      activationStatus: "INACTIVE",
    });

    return {
      id: String(vehicle._id),
      message: "Veículo cadastrado com sucesso.",
    };
  },
};
