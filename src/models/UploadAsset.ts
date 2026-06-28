import mongoose, { Document, Schema } from "mongoose";

export interface IUploadAsset extends Document {
  ownerUserId?: mongoose.Types.ObjectId | null;
  context: string;
  fileUrl: string;
  mimeType: string;
  size: number;
  originalName?: string | null;
  createdAt: Date;
}

const UploadAssetSchema = new Schema<IUploadAsset>({
  ownerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
    default: null,
    index: true,
  },
  context: {
    type: String,
    required: true,
    index: true,
  },
  fileUrl: {
    type: String,
    required: true,
  },
  mimeType: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    required: true,
  },
  originalName: {
    type: String,
    required: false,
    default: null,
  },
  createdAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
});

export default mongoose.model<IUploadAsset>("UploadAsset", UploadAssetSchema);

