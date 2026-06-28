import DriverDocument, { IDriverDocument } from "../models/DriverDocument";
import fs from "fs";
import mongoose from "mongoose";
import path from "path";
import AWS from "aws-sdk";

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getLocalUploadDir(user?: string) {
  return path.resolve(
    process.cwd(),
    "uploads",
    "driver-documents",
    user || "anonymous",
  );
}

function buildLocalFileUrl(user: string | undefined, fileName: string) {
  const baseUrl =
    (process.env.API_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, "");
  return `${baseUrl}/uploads/files/driver-documents/${user || "anonymous"}/${fileName}`;
}

export class DriverDocumentService {
  static async createDocument(
    data: Partial<IDriverDocument> & { fileBase64?: string; filename?: string }
  ) {
    const payload: any = { ...data };
    if (data.user) payload.user = new mongoose.Types.ObjectId(data.user as any);

    // If a base64 file was provided, upload to S3 and set fileUrl
    if (data.fileBase64 && data.filename) {
      if (!BUCKET_NAME) throw new Error("AWS_S3_BUCKET_NAME not configured");

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
      }/${Date.now()}-${data.filename}`;

      const params: AWS.S3.PutObjectRequest = {
        Bucket: BUCKET_NAME!,
        Key: key,
        Body: buffer,
        ACL: "public-read",
        ContentType: contentType || "application/octet-stream",
      };

      const uploadResult = await s3.upload(params).promise();
      payload.fileUrl = uploadResult.Location;
    }

    return new DriverDocument(payload).save();
  }

  /**
   * Faz upload de um arquivo (ex.: `Express.Multer.File`) para o S3.
   * Recebe um objeto que contém `buffer`, `originalname` e `mimetype`.
   * Retorna a URL pública do arquivo enviado.
   */
  static async uploadFile(file: any, user?: string) {
    if (!file) throw new Error("No file provided");

    const finalFileName = `${Date.now()}-${sanitizeFileName(
      file.originalname || file.name || "file",
    )}`;

    if (!BUCKET_NAME) {
      const uploadDir = getLocalUploadDir(user);
      fs.mkdirSync(uploadDir, { recursive: true });
      const targetPath = path.join(uploadDir, finalFileName);
      fs.writeFileSync(targetPath, file.buffer || file);
      return buildLocalFileUrl(user, finalFileName);
    }

    const key = `driver-documents/${user ? user : "anonymous"}/${finalFileName}`;

    const params: AWS.S3.PutObjectRequest | AWS.S3.GetObjectRequest = {
      Bucket: BUCKET_NAME!,
      Key: key,
      Body: file.buffer || file.stream || file,
      ContentType: file.mimetype || "application/octet-stream",
    };

    const uploadResult = await s3.upload(params).promise();
    return uploadResult.Location;
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
