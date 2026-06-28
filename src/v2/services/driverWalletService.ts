import crypto from "crypto";
import mongoose from "mongoose";
import ApiIdempotencyKey from "../../models/ApiIdempotencyKey";
import DriverTransfer from "../../models/DriverTransfer";
import DriverWallet from "../../models/DriverWallet";
import WalletLedgerEntry, { WalletLedgerType } from "../../models/WalletLedgerEntry";

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

  async createPixTransfer(
    driverUserId: string,
    payload: { cpf: string; amount: unknown },
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

    const cpf = ensureValidCpf(payload.cpf);
    const cpfMasked = maskCpf(cpf);
    const cpfHash = hashCpf(cpf);
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
        wallet.updatedAt = new Date();
        await wallet.save({ session });

        const transfer = await DriverTransfer.create(
          [
            {
              driverUserId,
              method: "PIX_CPF",
              cpfMasked,
              cpfHash,
              amount,
              status: "COMPLETED",
              providerTxId: `pix_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              createdAt: new Date(),
              updatedAt: new Date(),
              completedAt: new Date(),
            },
          ],
          { session },
        );

        const transferDoc: any = transfer[0];
        const receiptUrl = buildReceiptUrl(String(transferDoc._id));
        transferDoc.receiptUrl = receiptUrl;
        await transferDoc.save({ session });

        await WalletLedgerEntry.create(
          [
            {
              driverUserId,
              type: "PIX_TRANSFER_DEBIT",
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
          receiptUrl,
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

    return {
      success: true,
      transfer: {
        id: String((transfer as any)._id),
        method: transfer.method,
        cpfMasked: transfer.cpfMasked,
        amount: transfer.amount,
        status: transfer.status,
        providerTxId: transfer.providerTxId || null,
        receiptUrl: transfer.receiptUrl || null,
        failureReason: transfer.failureReason || null,
        createdAt: transfer.createdAt,
        updatedAt: transfer.updatedAt,
        completedAt: transfer.completedAt || null,
        failedAt: transfer.failedAt || null,
      },
    };
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

