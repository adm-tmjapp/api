import Vehicle, { IVehicle } from "../models/Vehicle";
import mongoose from "mongoose";

export class VehicleService {
  static async createVehicle(data: Partial<IVehicle>): Promise<IVehicle> {
    const vehicle = new Vehicle({
      ...data,
      userId: data.userId
        ? new mongoose.Types.ObjectId(data.userId)
        : undefined,
      photo: data.photo ? new mongoose.Types.ObjectId(data.photo) : undefined,
      documents: Array.isArray(data.documents)
        ? data.documents.map((d: any) => new mongoose.Types.ObjectId(d))
        : undefined,
    } as Partial<IVehicle>);

    return vehicle.save();
  }

  static async findByRenavamOrPlate(renavam: string, vehiclePlate: string) {
    return Vehicle.findOne({ $or: [{ renavam }, { vehiclePlate }] })
      .lean()
      .exec();
  }

  static async findConflictForOnboarding(input: {
    userId: string;
    vehiclePlate: string;
    renavam?: string | null;
  }) {
    const conditions: any[] = [{ vehiclePlate: input.vehiclePlate }];

    if (input.renavam) {
      conditions.push({ renavam: input.renavam });
    }

    return Vehicle.findOne({
      userId: { $ne: new mongoose.Types.ObjectId(input.userId) },
      $or: conditions,
    })
      .lean()
      .exec();
  }

  static async upsertOnboardingVehicle(data: {
    userId: string;
    vehicleType: "carro" | "moto";
    manufacturer: string;
    modelName: string;
    year: string;
    color: string;
    vehiclePlate: string;
    usage: "ENTREGAS" | "PASSAGEIROS" | "AMBOS";
    renavam?: string | null;
  }) {
    const payload = {
      userId: new mongoose.Types.ObjectId(data.userId),
      vehicleType: data.vehicleType,
      manufacturer: data.manufacturer.trim(),
      modelName: data.modelName.trim(),
      year: data.year.trim(),
      color: data.color.trim(),
      vehiclePlate: data.vehiclePlate.trim().toUpperCase(),
      usage: data.usage,
      renavam: data.renavam ? data.renavam.trim() : undefined,
      status: "PENDING" as const,
      documentationStatus: "PENDING" as const,
      activationStatus: "INACTIVE" as const,
      approvedAt: undefined,
      approvedBy: undefined,
    };

    return Vehicle.findOneAndUpdate(
      { userId: payload.userId },
      payload,
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    ).exec();
  }

  static async listVehicles(filter: any = {}, page = 1, limit = 20) {
    const query: any = { ...filter };
    const total = await Vehicle.countDocuments(query).exec();
    const vehicles = await Vehicle.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("photo")
      .populate("documents")
      .lean()
      .exec();

    return { vehicles, total };
  }

  static async getVehicleById(id: string) {
    return Vehicle.findById(id).populate("photo").populate("documents").exec();
  }

  static async updateVehicle(id: string, update: Partial<IVehicle>) {
    const payload: any = { ...update };
    if (update.photo)
      payload.photo = new mongoose.Types.ObjectId(update.photo as any);
    if (update.documents)
      payload.documents = (update.documents as any[]).map(
        (d) => new mongoose.Types.ObjectId(d)
      );

    return Vehicle.findByIdAndUpdate(id, payload, { new: true }).exec();
  }

  static async deleteVehicle(id: string) {
    return Vehicle.findByIdAndDelete(id).exec();
  }

  static async approveVehicle(id: string, approvedBy?: string) {
    const payload: any = {
      status: "APPROVED",
      documentationStatus: "APPROVED",
      approvedAt: new Date(),
    };
    if (approvedBy)
      payload.approvedBy = new mongoose.Types.ObjectId(approvedBy);
    return Vehicle.findByIdAndUpdate(id, payload, { new: true }).exec();
  }

  static async rejectVehicle(id: string) {
    return Vehicle.findByIdAndUpdate(
      id,
      { status: "REJECTED", documentationStatus: "REJECTED" },
      { new: true }
    ).exec();
  }

  static async addDocument(id: string, documentId: string) {
    const vehicle = await Vehicle.findById(id).exec();
    if (!vehicle) return null;
    vehicle.documents = vehicle.documents || [];
    vehicle.documents.push(new mongoose.Types.ObjectId(documentId));
    return vehicle.save();
  }

  static async removeDocument(id: string, documentId: string) {
    const vehicle = await Vehicle.findById(id).exec();
    if (!vehicle) return null;
    vehicle.documents = (vehicle.documents || []).filter(
      (d: any) => d.toString() !== documentId
    );
    return vehicle.save();
  }

  static async updatePhoto(id: string, photoId: string) {
    return Vehicle.findByIdAndUpdate(
      id,
      { photo: new mongoose.Types.ObjectId(photoId) },
      { new: true }
    ).exec();
  }
}

export default VehicleService;
