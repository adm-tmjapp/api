import { Request, Response } from "express";
import DriverDocumentService from "../../services/driverDocumentService";
import UploadAsset from "../../models/UploadAsset";

function handleError(res: Response, statusCode: number, message: string, details: Record<string, unknown> = {}) {
  res.status(statusCode).json({
    statusCode,
    error: statusCode === 422 ? "VALIDATION_ERROR" : "INTERNAL_ERROR",
    message,
    details,
  });
}

export const uploadV2Controller = {
  async upload(req: Request, res: Response) {
    try {
      const file = (req as any).file;
      const context = String(req.body?.context || "").trim();
      const ownerUserId = req.user?.id;

      if (!file) {
        handleError(res, 422, "Arquivo é obrigatório.");
        return;
      }

      if (!context) {
        handleError(res, 422, "context é obrigatório.");
        return;
      }

      const fileUrl = await DriverDocumentService.uploadFile(file, ownerUserId);
      const asset = await UploadAsset.create({
        ownerUserId: ownerUserId || null,
        context,
        fileUrl,
        mimeType: file.mimetype || "application/octet-stream",
        size: file.size || 0,
        originalName: file.originalname || null,
        createdAt: new Date(),
      });

      res.status(201).json({
        fileId: String(asset._id),
        url: asset.fileUrl,
        mimeType: asset.mimeType,
        size: asset.size,
      });
    } catch (error: any) {
      handleError(res, 500, "Erro ao fazer upload do arquivo.", {
        message: error?.message || null,
      });
    }
  },
};

