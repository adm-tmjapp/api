import crypto from "crypto";
import mongoose from "mongoose";
import ApiIdempotencyKey from "../../models/ApiIdempotencyKey";
import DriverTransfer from "../../models/DriverTransfer";
import DriverWallet from "../../models/DriverWallet";
import WalletLedgerEntry, { WalletLedgerType } from "../../models/WalletLedgerEntry";
import User from "../../models/User";
import { AsaasTransferProvider } from "../../payments/providers/asaas/AsaasTransferProvider";

type WalletPeriod = "today" | "week" | "month";

type WalletActivityFilters = {
  type?: WalletLedgerType;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
};

type ServiceErrorCode =
  | "INVALID_TRANSFER_ID"
  | "TRANSFER_NOT_FOUND"
  | "INVALID_AMOUNT"
  | "INVALID_CPF"
  | "INSUFFICIENT_BALANCE"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "IDEMPOTENCY_IN_PROGRESS";

export class DriverWalletServiceError extends Error {
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

const TRANSFER_PIX_ENDPOINT = "/api/v2/driver/wallet/transfers/pix";
const ACTIVITY_LIMIT_DEFAULT = 20;
const ACTIVITY_LIMIT_MAX = 100;

function normalizeLimit(limit?: number): number {
  if (!limit || Number.isNaN(limit) || limit <= 0) return ACTIVITY_LIMIT_DEFAULT;
  return Math.min(limit, ACTIVITY_LIMIT_MAX);
}

function normalizeOffset(offset?: number): number {
  if (!offset || Number.isNaN(offset) || offset < 0) return 0;
  return offset;
}

function toDateRange(period: WalletPeriod): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now);

  if (period === "today") {
    from.setHours(0, 0, 0, 0);
    return { from, to: now };
  }

  if (period === "week") {
    const day = from.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    from.setDate(from.getDate() + diff);
    from.setHours(0, 0, 0, 0);
    return { from, to: now };
  }

  from.setDate(1);
  from.setHours(0, 0, 0, 0);
  return { from, to: now };
}

function ensurePeriod(period?: string): WalletPeriod {
  if (period === "week" || period === "month") return period;
  return "today";
}

function normalizeAmount(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new DriverWalletServiceError(
      400,
      "INVALID_AMOUNT",
      "Valor da transferência deve ser maior que zero.",
    );
  }
  return Number(amount.toFixed(2));
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function isValidCpf(cpf: string): boolean {
  const cleaned = digitsOnly(cpf);
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;

  const calcCheckDigit = (base: string, factor: number) => {
    const sum = base
      .split("")
      .reduce((acc, char) => acc + Number(char) * factor--, 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const digit1 = calcCheckDigit(cleaned.substring(0, 9), 10);
  const digit2 = calcCheckDigit(cleaned.substring(0, 10), 11);
  return cleaned.endsWith(`${digit1}${digit2}`);
}

function ensureValidCpf(cpf: string): string {
  const cleaned = digitsOnly(cpf);
  if (!isValidCpf(cleaned)) {
    throw new DriverWalletServiceError(400, "INVALID_CPF", "CPF inválido.");
  }
  return cleaned;
}

function maskCpf(cpf: string): string {
  return `${cpf.slice(0, 3)}.***.***-${cpf.slice(-2)}`;
}

function hashCpf(cpf: string): string {
  return crypto.createHash("sha256").update(cpf).digest("hex");
}

type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

function encryptionKey(): Buffer {
  return crypto
    .createHash("sha256")
    .update(String(process.env.DRIVER_PIX_ENCRYPTION_KEY || process.env.JWT_SECRET || process.env.ASAAS_API_KEY || "tmjapp-driver-pix"))
    .digest();
}

function encryptPixKey(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

function decryptPixKey(value: string): string {
  const [ivRaw, tagRaw, encryptedRaw] = value.split(".");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64url")), decipher.final()]).toString("utf8");
}

function normalizePixKeyType(value: unknown): PixKeyType {
  const type = String(value || "CPF").trim().toUpperCase();
  if (!["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"].includes(type)) {
    throw new DriverWalletServiceError(400, "INVALID_CPF", "Tipo de chave PIX inválido.");
  }
  return type as PixKeyType;
}

function normalizePixKey(value: unknown, type: PixKeyType): string {
  const key = String(value || "").trim();
  if (!key) throw new DriverWalletServiceError(400, "INVALID_CPF", "Chave PIX é obrigatória.");
  if (type === "CPF") return ensureValidCpf(key);
  if (type === "CNPJ") {
    const digits = digitsOnly(key);
    if (digits.length !== 14) throw new DriverWalletServiceError(400, "INVALID_CPF", "CNPJ inválido.");
    return digits;
  }
  if (type === "PHONE") {
    const digits = digitsOnly(key);
    if (digits.length !== 11) throw new DriverWalletServiceError(400, "INVALID_CPF", "Telefone PIX inválido.");
    return digits;
  }
  if (type === "EMAIL" && !/^\S+@\S+\.\S+$/.test(key)) {
    throw new DriverWalletServiceError(400, "INVALID_CPF", "E-mail PIX inválido.");
  }
  return key;
}

function maskPixKey(value: string, type: PixKeyType): string {
  if (type === "CPF") return maskCpf(value);
  if (type === "CNPJ") return `${value.slice(0, 2)}.***.***/****-${value.slice(-2)}`;
  if (type === "EMAIL") {
    const [name, domain] = value.split("@");
    return `${name.slice(0, 2)}***@${domain}`;
  }
  if (type === "PHONE") return `(${value.slice(0, 2)}) *****-${value.slice(-4)}`;
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

function publicTransfer(transfer: any) {
  return {
    id: String(transfer._id),
    method: transfer.method,
    pixKeyType: transfer.pixKeyType || "CPF",
    pixKeyMasked: transfer.pixKeyMasked || transfer.cpfMasked,
    cpfMasked: transfer.cpfMasked,
    amount: transfer.amount,
    status: transfer.status,
    providerTxId: transfer.providerTxId || null,
    providerStatus: transfer.providerStatus || null,
    receiptUrl: transfer.providerReceiptUrl || transfer.receiptUrl || null,
    failureReason: transfer.failureReason || null,
    rejectionReason: transfer.rejectionReason || null,
    createdAt: transfer.createdAt,
    updatedAt: transfer.updatedAt,
    reviewedAt: transfer.reviewedAt || null,
    completedAt: transfer.completedAt || null,
    failedAt: transfer.failedAt || null,
  };
}

function buildReceiptUrl(transferId: string): string {
  const apiBase =
    process.env.API_PUBLIC_BASE_URL?.replace(/\/$/, "") || "http://localhost:3000";
  return `${apiBase}/api/v2/driver/wallet/transfers/${transferId}/receipt`;
}

async function ensureWallet(driverUserId: string) {
  const wallet = await DriverWallet.findOneAndUpdate(
    { driverUserId },
    {
      $setOnInsert: {
        driverUserId,
        availableBalance: 0,
        pendingBalance: 0,
        updatedAt: new Date(),
        createdAt: new Date(),
      },
    },
    { new: true, upsert: true },
  );

  return wallet;
}

async function sumEarnings(
  driverUserId: string,
  from?: Date,
  to?: Date,
): Promise<number> {
  const match: any = {
    driverUserId: new mongoose.Types.ObjectId(driverUserId),
    type: { $in: ["RIDE_CREDIT", "BONUS", "ADJUSTMENT"] },
    amount: { $gt: 0 },
  };
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = from;
    if (to) match.createdAt.$lte = to;
  }

  const result = await WalletLedgerEntry.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  return Number((result?.[0]?.total || 0).toFixed(2));
}

export const driverWalletService = {
  async getSummary(driverUserId: string, periodInput?: string) {
    const period = ensurePeriod(periodInput);
    const wallet = await ensureWallet(driverUserId);

    const weekRange = toDateRange("week");
    const periodRange = toDateRange(period);

    const [weekEarnings, totalAccumulated, periodEarnings] = await Promise.all([
      sumEarnings(driverUserId, weekRange.from, weekRange.to),
      sumEarnings(driverUserId),
      sumEarnings(driverUserId, periodRange.from, periodRange.to),
    ]);

    return {
      success: true,
      period,
      balances: {
        available: Number((wallet.availableBalance || 0).toFixed(2)),
        pending: Number((wallet.pendingBalance || 0).toFixed(2)),
      },
      weekEarnings,
      totalAccumulated,
      periodEarnings,
      updatedAt: wallet.updatedAt,
    };
  },

  async getActivities(driverUserId: string, filters: WalletActivityFilters) {
    const limit = normalizeLimit(filters.limit);
    const offset = normalizeOffset(filters.offset);

    const query: any = { driverUserId };
    if (filters.type) query.type = filters.type;
    if (filters.from || filters.to) {
      query.createdAt = {};
      if (filters.from) query.createdAt.$gte = filters.from;
      if (filters.to) query.createdAt.$lte = filters.to;
    }

    const [items, total] = await Promise.all([
      WalletLedgerEntry.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      WalletLedgerEntry.countDocuments(query),
    ]);

    return {
      success: true,
      items: items.map((item: any) => ({
        id: String(item._id),
        type: item.type,
        amount: item.amount,
        balanceAfter: item.balanceAfter,
        referenceType: item.referenceType || null,
        referenceId: item.referenceId || null,
        createdAt: item.createdAt,
      })),
      total,
      limit,
      offset,
    };
  },

  async requestWithdrawal(
    driverUserId: string,
    payload: { cpf?: string; pixKey?: string; pixKeyType?: unknown; amount: unknown },
    idempotencyKey?: string,
  ) {
    if (!idempotencyKey || !idempotencyKey.trim()) {
      throw new DriverWalletServiceError(
        400,
        "IDEMPOTENCY_KEY_REQUIRED",
        "Header Idempotency-Key é obrigatório.",
      );
    }

    const key = idempotencyKey.trim();
    const existing = await ApiIdempotencyKey.findOne({
      driverUserId,
      endpoint: TRANSFER_PIX_ENDPOINT,
      idempotencyKey: key,
    }).lean();

    if (existing?.status === "COMPLETED" && existing.responsePayload) {
      return existing.responsePayload;
    }
    if (existing?.status === "PROCESSING") {
      throw new DriverWalletServiceError(
        409,
        "IDEMPOTENCY_IN_PROGRESS",
        "Já existe uma solicitação em processamento para essa chave de idempotência.",
      );
    }

    const pixKeyType = normalizePixKeyType(payload.pixKeyType || "CPF");
    const pixKey = normalizePixKey(payload.pixKey || payload.cpf, pixKeyType);
    const pixKeyMasked = maskPixKey(pixKey, pixKeyType);
    const cpf = pixKeyType === "CPF" ? pixKey : "";
    const cpfMasked = pixKeyType === "CPF" ? pixKeyMasked : "***";
    const cpfHash = hashCpf(pixKey);
    const amount = normalizeAmount(payload.amount);

    const session = await mongoose.startSession();

    try {
      let responsePayload: any = null;
      await session.withTransaction(async () => {
        await ApiIdempotencyKey.create(
          [
            {
              driverUserId,
              endpoint: TRANSFER_PIX_ENDPOINT,
              idempotencyKey: key,
              status: "PROCESSING",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          { session },
        );

        const wallet = await DriverWallet.findOneAndUpdate(
          { driverUserId },
          {
            $setOnInsert: {
              driverUserId,
              availableBalance: 0,
              pendingBalance: 0,
              createdAt: new Date(),
            },
          },
          { session, new: true, upsert: true },
        );

        if ((wallet.availableBalance || 0) < amount) {
          throw new DriverWalletServiceError(
            422,
            "INSUFFICIENT_BALANCE",
            "Saldo disponível insuficiente para transferência.",
          );
        }

        const nextBalance = Number((wallet.availableBalance - amount).toFixed(2));
        wallet.availableBalance = nextBalance;
        wallet.pendingBalance = Number(((wallet.pendingBalance || 0) + amount).toFixed(2));
        wallet.updatedAt = new Date();
        await wallet.save({ session });

        const transfer = await DriverTransfer.create(
          [
            {
              driverUserId,
              method: "PIX_CPF",
              pixKeyType,
              pixKeyMasked,
              pixKeyEncrypted: encryptPixKey(pixKey),
              cpfMasked,
              cpfHash,
              amount,
              status: "REQUESTED",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          { session },
        );

        const transferDoc: any = transfer[0];
        await WalletLedgerEntry.create(
          [
            {
              driverUserId,
              type: "PIX_TRANSFER_HOLD",
              amount: Number((-amount).toFixed(2)),
              balanceAfter: nextBalance,
              referenceType: "TRANSFER",
              referenceId: String(transferDoc._id),
              createdAt: new Date(),
            },
          ],
          { session },
        );

        responsePayload = {
          success: true,
          transferId: String(transferDoc._id),
          status: transferDoc.status,
          createdAt: transferDoc.createdAt,
          receiptUrl: null,
        };

        await ApiIdempotencyKey.findOneAndUpdate(
          {
            driverUserId,
            endpoint: TRANSFER_PIX_ENDPOINT,
            idempotencyKey: key,
          },
          {
            $set: {
              status: "COMPLETED",
              responsePayload,
              resourceId: String(transferDoc._id),
              updatedAt: new Date(),
            },
          },
          { session },
        );
      });

      return responsePayload;
    } catch (error: any) {
      if (error?.code === 11000) {
        const existingAfterConflict = await ApiIdempotencyKey.findOne({
          driverUserId,
          endpoint: TRANSFER_PIX_ENDPOINT,
          idempotencyKey: key,
        }).lean();

        if (existingAfterConflict?.status === "COMPLETED") {
          return existingAfterConflict.responsePayload;
        }

        throw new DriverWalletServiceError(
          409,
          "IDEMPOTENCY_IN_PROGRESS",
          "Solicitação duplicada em processamento.",
        );
      }

      if (error instanceof DriverWalletServiceError) {
        await ApiIdempotencyKey.findOneAndUpdate(
          {
            driverUserId,
            endpoint: TRANSFER_PIX_ENDPOINT,
            idempotencyKey: key,
          },
          {
            $set: {
              status: "FAILED",
              errorPayload: {
                message: error.message,
                code: error.code,
                details: error.details || null,
              },
              updatedAt: new Date(),
            },
          },
        );
        throw error;
      }

      throw error;
    } finally {
      session.endSession();
    }
  },

  async createPixTransfer(
    driverUserId: string,
    payload: { cpf?: string; pixKey?: string; pixKeyType?: unknown; amount: unknown },
    idempotencyKey?: string,
  ) {
    return this.requestWithdrawal(driverUserId, payload, idempotencyKey);
  },

  async listDriverTransfers(driverUserId: string, status?: string) {
    const query: any = { driverUserId };
    if (status) query.status = status;
    const transfers = await DriverTransfer.find(query).sort({ createdAt: -1 }).limit(100).lean();
    return { success: true, items: transfers.map(publicTransfer) };
  },

  async listAdminTransfers(input: { status?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(input.page || 1));
    const limit = Math.min(100, Math.max(1, Number(input.limit || 20)));
    const query: any = {};
    if (input.status) query.status = input.status;
    const [items, total] = await Promise.all([
      DriverTransfer.find(query)
        .populate("driverUserId", "name email phone")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      DriverTransfer.countDocuments(query),
    ]);
    return {
      success: true,
      items: items.map((item: any) => ({
        ...publicTransfer(item),
        driver: item.driverUserId
          ? { id: String(item.driverUserId._id), name: item.driverUserId.name, email: item.driverUserId.email, phone: item.driverUserId.phone }
          : null,
      })),
      page,
      limit,
      total,
    };
  },

  async rejectWithdrawal(transferId: string, adminUserId: string, reason: string) {
    if (!mongoose.Types.ObjectId.isValid(transferId)) throw new DriverWalletServiceError(400, "INVALID_TRANSFER_ID", "Transfer ID inválido.");
    if (!reason?.trim()) throw new DriverWalletServiceError(400, "INVALID_AMOUNT", "Informe o motivo da rejeição.");
    const session = await mongoose.startSession();
    try {
      let transfer: any;
      await session.withTransaction(async () => {
        transfer = await DriverTransfer.findOne({ _id: transferId, status: "REQUESTED" }).session(session);
        if (!transfer) throw new DriverWalletServiceError(409, "TRANSFER_NOT_FOUND", "Solicitação não está pendente.");
        const wallet = await DriverWallet.findOneAndUpdate(
          { driverUserId: transfer.driverUserId },
          { $inc: { availableBalance: transfer.amount, pendingBalance: -transfer.amount }, $set: { updatedAt: new Date() } },
          { new: true, session },
        );
        transfer.status = "REJECTED";
        transfer.rejectionReason = reason.trim();
        transfer.reviewedBy = adminUserId;
        transfer.reviewedAt = new Date();
        transfer.updatedAt = new Date();
        await transfer.save({ session });
        await WalletLedgerEntry.create([{
          driverUserId: transfer.driverUserId,
          type: "PIX_TRANSFER_RELEASE",
          amount: transfer.amount,
          balanceAfter: wallet?.availableBalance || 0,
          referenceType: "TRANSFER",
          referenceId: String(transfer._id),
        }], { session });
      });
      return { success: true, transfer: publicTransfer(transfer) };
    } finally { await session.endSession(); }
  },

  async approveWithdrawal(transferId: string, adminUserId: string) {
    if (!mongoose.Types.ObjectId.isValid(transferId)) throw new DriverWalletServiceError(400, "INVALID_TRANSFER_ID", "Transfer ID inválido.");
    const transfer: any = await DriverTransfer.findOneAndUpdate(
      { _id: transferId, status: "REQUESTED" },
      { $set: { status: "APPROVED", reviewedBy: adminUserId, reviewedAt: new Date(), updatedAt: new Date() } },
      { new: true },
    );
    if (!transfer) throw new DriverWalletServiceError(409, "TRANSFER_NOT_FOUND", "Solicitação não está pendente.");
    try {
      const provider = new AsaasTransferProvider();
      const result = await provider.createPixTransfer({
        value: transfer.amount,
        pixAddressKey: decryptPixKey(transfer.pixKeyEncrypted),
        pixAddressKeyType: transfer.pixKeyType,
        externalReference: String(transfer._id),
      });
      const updated: any = await DriverTransfer.findOneAndUpdate(
        { _id: transfer._id, status: "APPROVED" },
        { $set: { status: "PROCESSING", providerTxId: result.id, providerStatus: result.status || "PENDING", providerReceiptUrl: result.transactionReceiptUrl, updatedAt: new Date() } },
        { new: true },
      );
      return { success: true, transfer: publicTransfer(updated || transfer) };
    } catch (error: any) {
      await this.releaseFailedTransfer(String(transfer._id), error?.message || "Falha ao solicitar transferência no ASAAS.");
      throw error;
    }
  },

  async releaseFailedTransfer(transferId: string, reason: string) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const transfer: any = await DriverTransfer.findOne({ _id: transferId, status: { $in: ["APPROVED", "PROCESSING"] } }).session(session);
        if (!transfer) return;
        const wallet = await DriverWallet.findOneAndUpdate(
          { driverUserId: transfer.driverUserId },
          { $inc: { availableBalance: transfer.amount, pendingBalance: -transfer.amount }, $set: { updatedAt: new Date() } },
          { new: true, session },
        );
        transfer.status = "FAILED";
        transfer.failureReason = reason;
        transfer.failedAt = new Date();
        transfer.updatedAt = new Date();
        await transfer.save({ session });
        await WalletLedgerEntry.create([{
          driverUserId: transfer.driverUserId,
          type: "PIX_TRANSFER_RELEASE",
          amount: transfer.amount,
          balanceAfter: wallet?.availableBalance || 0,
          referenceType: "TRANSFER",
          referenceId: String(transfer._id),
        }], { session });
      });
    } finally { await session.endSession(); }
  },

  async handleAsaasTransferWebhook(payload: Record<string, any>) {
    const eventId = String(payload.id || "").trim();
    const providerTransferId = String(payload.transfer?.id || "").trim();
    if (!providerTransferId) return { ignored: true };
    const transfer: any = await DriverTransfer.findOne({ providerTxId: providerTransferId });
    if (!transfer) return { ignored: true };
    const event = String(payload.event || "").toUpperCase();
    if (!["TRANSFER_DONE", "TRANSFER_FAILED", "TRANSFER_CANCELLED", "TRANSFER_PENDING", "TRANSFER_IN_BANK_PROCESSING", "TRANSFER_BLOCKED"].includes(event)) return { ignored: true };
    if (event === "TRANSFER_DONE") {
      const session = await mongoose.startSession();
      try { await session.withTransaction(async () => {
        const current: any = await DriverTransfer.findOne({ _id: transfer._id, status: { $in: ["PROCESSING", "APPROVED"] } }).session(session);
        if (!current) return;
        const wallet = await DriverWallet.findOneAndUpdate({ driverUserId: current.driverUserId }, { $inc: { pendingBalance: -current.amount }, $set: { updatedAt: new Date() } }, { new: true, session });
        current.status = "COMPLETED";
        current.providerStatus = "DONE";
        current.providerReceiptUrl = payload.transfer?.transactionReceiptUrl || null;
        current.completedAt = new Date();
        current.updatedAt = new Date();
        await current.save({ session });
        await WalletLedgerEntry.updateOne({ referenceType: "TRANSFER", referenceId: String(current._id), type: "PIX_TRANSFER_HOLD" }, { $set: { type: "PIX_TRANSFER_DEBIT" } }, { session });
        void wallet;
      }); } finally { await session.endSession(); }
    } else if (["TRANSFER_FAILED", "TRANSFER_CANCELLED"].includes(event)) {
      await this.releaseFailedTransfer(String(transfer._id), String(payload.transfer?.failReason || event));
    } else {
      await DriverTransfer.updateOne({ _id: transfer._id }, { $set: { providerStatus: payload.transfer?.status || event, updatedAt: new Date() } });
    }
    return { ignored: false, eventId };
  },

  async getTransfer(driverUserId: string, transferId: string) {
    if (!mongoose.Types.ObjectId.isValid(transferId)) {
      throw new DriverWalletServiceError(
        400,
        "INVALID_TRANSFER_ID",
        "Transfer ID inválido.",
      );
    }

    const transfer = await DriverTransfer.findOne({
      _id: transferId,
      driverUserId,
    }).lean();

    if (!transfer) {
      throw new DriverWalletServiceError(
        404,
        "TRANSFER_NOT_FOUND",
        "Transferência não encontrada.",
      );
    }

    return { success: true, transfer: publicTransfer(transfer) };
  },

  async getTransferReceipt(driverUserId: string, transferId: string) {
    const transferPayload = await this.getTransfer(driverUserId, transferId);
    const receiptUrl =
      transferPayload.transfer.receiptUrl || buildReceiptUrl(transferId);

    return {
      success: true,
      transferId,
      status: transferPayload.transfer.status,
      receiptUrl,
      issuedAt: new Date().toISOString(),
    };
  },
};
