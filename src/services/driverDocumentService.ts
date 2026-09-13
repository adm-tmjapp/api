import DriverDocument, { IDriverDocument } from "../models/DriverDocument";
import mongoose from "mongoose";
import { Storage } from "@google-cloud/storage";

const storage = new Storage();

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function buildStorageFileUrl(
  bucketName: string,
  objectName: string,
) {
  const [url] = await storage.bucket(bucketName).file(objectName).getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
  return url;
}

function getStorageBucket() {
  const bucketName = process.env.GCS_BUCKET_NAME?.trim();
  if (!bucketName) {
    throw new Error("GCS_BUCKET_NAME não configurado");
  }
  return storage.bucket(bucketName);
}

export class DriverDocumentService {
  static async createDocument(
    data: Partial<IDriverDocument> & { fileBase64?: string; filename?: string }
  ) {
    const payload: any = { ...data };
    if (data.user) payload.user = new mongoose.Types.ObjectId(data.user as any);

    // If a base64 file was provided, upload to Google Cloud Storage and set fileUrl.
    if (data.fileBase64 && data.filename) {
      // Convert base64 to buffer
      const matches = data.fileBase64.match(/^data:(.+);base64,(.+)$/);
      let buffer: Buffer;
      let contentType: string | undefined;
      if (matches) {
        contentType = matches[1];
        buffer = Buffer.from(matches[2], "base64");
      } else {
        // assume raw base64 without data URI
        buffer = Buffer.from(data.fileBase64, "base64");
      }

      const key = `driver-documents/${
        payload.user ? payload.user.toString() : "anonymous"
      }/${Date.now()}-${sanitizeFileName(data.filename)}`;

      const bucket = getStorageBucket();
      const file = bucket.file(key);
      await file.save(buffer, {
        resumable: false,
        metadata: {
          contentType: contentType || "application/octet-stream",
        },
      });
      payload.fileUrl = await buildStorageFileUrl(bucket.name, key);
    }

    return new DriverDocument(payload).save();
  }

  /**
   * Faz upload de um arquivo (ex.: `Express.Multer.File`) para o Google Cloud Storage.
   * Recebe um objeto que contém `buffer`, `originalname` e `mimetype`.
   * Retorna uma URL assinada temporária para o arquivo enviado.
   */
  static async uploadFile(file: any, user?: string) {
    if (!file) throw new Error("No file provided");

    const finalFileName = `${Date.now()}-${sanitizeFileName(
      file.originalname || file.name || "file",
    )}`;

    const key = `driver-documents/${user || "anonymous"}/${finalFileName}`;
    const buffer = file.buffer || file;
    if (!Buffer.isBuffer(buffer)) {
      throw new Error("Arquivo de upload sem conteúdo em memória");
    }

    const bucket = getStorageBucket();
    const target = bucket.file(key);
    await target.save(buffer, {
      resumable: false,
      metadata: {
        contentType: file.mimetype || "application/octet-stream",
      },
    });

    return buildStorageFileUrl(bucket.name, key);
  }

  static async upsertDriverDocumentWithFile(data: {
    userId: string;
    type:
      | "CNH"
      | "SELFIE"
      | "CRLV"
      | "RG"
      | "CPF"
      | "OUTRO"
      | "RESIDENCE_PROOF"
      | "CRIMINAL_RECORD";
    side?: "FRONT" | "BACK";
    file: any;
  }) {
    const fileUrl = await this.uploadFile(data.file, data.userId);
    const query: any = {
      user: new mongoose.Types.ObjectId(data.userId),
      type: data.type,
    };

    if (data.side) {
      query.side = data.side;
    }

    return DriverDocument.findOneAndUpdate(
      query,
      {
        user: new mongoose.Types.ObjectId(data.userId),
        type: data.type,
        side: data.side,
        fileUrl,
        filename: data.file.originalname || data.file.name,
        status: "PENDING",
        rejectionReason: undefined,
        reviewedAt: undefined,
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    ).exec();
  }

  static async listDocuments(filter: any = {}, page = 1, limit = 20) {
    const query = { ...filter };
    const total = await DriverDocument.countDocuments(query).exec();
    const documents = await DriverDocument.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();
    return { documents, total };
  }

  static async getById(id: string) {
    return DriverDocument.findById(id).exec();
  }

  static async updateDocument(id: string, update: Partial<IDriverDocument>) {
    const payload: any = { ...update };
    return DriverDocument.findByIdAndUpdate(id, payload, { new: true }).exec();
  }

  static async deleteDocument(id: string) {
    return DriverDocument.findByIdAndDelete(id).exec();
  }

  static async approveDocument(id: string) {
    return DriverDocument.findByIdAndUpdate(
      id,
      { status: "APPROVED", reviewedAt: new Date() },
      { new: true }
    ).exec();
  }

  static async rejectDocument(id: string, reason?: string) {
    return DriverDocument.findByIdAndUpdate(
      id,
      { status: "REJECTED", rejectionReason: reason, reviewedAt: new Date() },
      { new: true }
    ).exec();
  }

  static async listByUser(userId: string, page = 1, limit = 20) {
    const query = { user: new mongoose.Types.ObjectId(userId) };
    return this.listDocuments(query, page, limit);
  }
}

export default DriverDocumentService;
