import mongoose from "mongoose";
import AdminAuditLog from "../../models/AdminAuditLog";
import PaymentSettings, {
  PaymentSettingsScopeType,
} from "../../models/PaymentSettings";
import { paymentPolicyEngine } from "../../payments/application/PaymentPolicyEngine";

type PaymentMethod = "PIX" | "CREDIT_CARD";

type PaymentSettingsInput = {
  provider?: string | null;
  enabledMethods: PaymentMethod[];
  defaultMethod: PaymentMethod;
  allowSavedCard: boolean;
  scopeType: PaymentSettingsScopeType;
  scopeId?: string | null;
};

class AdminPaymentSettingsError extends Error {
  statusCode: number;

  code: string;

  details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function normalizeScope(scopeType?: string, scopeId?: string | null) {
  const normalizedScopeType = String(scopeType || "GLOBAL").toUpperCase();
  const allowed = ["GLOBAL", "CITY", "PRODUCT", "OPERATION"];

  if (!allowed.includes(normalizedScopeType)) {
    throw new AdminPaymentSettingsError(
      422,
      "VALIDATION_ERROR",
      "Escopo inválido.",
      { field: "scopeType" },
    );
  }

  const normalizedScopeId = scopeId ? String(scopeId).trim() : null;
  if (normalizedScopeType === "GLOBAL") {
    return {
      scopeType: "GLOBAL" as PaymentSettingsScopeType,
      scopeId: null,
    };
  }

  if (!normalizedScopeId) {
    throw new AdminPaymentSettingsError(
      422,
      "VALIDATION_ERROR",
      "scopeId é obrigatório para este escopo.",
      { field: "scopeId" },
    );
  }

  return {
    scopeType: normalizedScopeType as PaymentSettingsScopeType,
    scopeId: normalizedScopeId,
  };
}

function normalizeMethods(input: unknown): PaymentMethod[] {
  const methods = Array.isArray(input) ? input : [];
  const normalized = methods
    .map((item) => String(item).trim().toUpperCase())
    .filter((item): item is PaymentMethod => item === "PIX" || item === "CREDIT_CARD");

  return [...new Set(normalized)];
}

function validateInput(input: PaymentSettingsInput) {
  const enabledMethods = normalizeMethods(input.enabledMethods);

  if (!enabledMethods.length) {
    throw new AdminPaymentSettingsError(
      422,
      "VALIDATION_ERROR",
      "Informe pelo menos uma forma de pagamento habilitada.",
      { field: "enabledMethods" },
    );
  }

  const defaultMethod = String(input.defaultMethod || "").trim().toUpperCase();
  if (defaultMethod !== "PIX" && defaultMethod !== "CREDIT_CARD") {
    throw new AdminPaymentSettingsError(
      422,
      "VALIDATION_ERROR",
      "defaultMethod inválido.",
      { field: "defaultMethod" },
    );
  }

  if (!enabledMethods.includes(defaultMethod as PaymentMethod)) {
    throw new AdminPaymentSettingsError(
      422,
      "VALIDATION_ERROR",
      "defaultMethod deve estar dentro de enabledMethods.",
      { field: "defaultMethod" },
    );
  }

  if (input.allowSavedCard && !enabledMethods.includes("CREDIT_CARD")) {
    throw new AdminPaymentSettingsError(
      422,
      "VALIDATION_ERROR",
      "allowSavedCard exige CREDIT_CARD habilitado.",
      { field: "allowSavedCard" },
    );
  }

  return {
    provider: input.provider ? String(input.provider).trim() : null,
    enabledMethods,
    defaultMethod: defaultMethod as PaymentMethod,
    allowSavedCard: !!input.allowSavedCard,
  };
}

async function serializeSettings(document: any) {
  if (!document) return null;

  const updatedBy = document.updatedBy
    ? {
        id: String(document.updatedBy._id || document.updatedBy.id || document.updatedBy),
        name: document.updatedBy.name || null,
      }
    : null;

  return {
    id: String(document._id),
    provider: document.provider || "asaas",
    enabledMethods: normalizeMethods(document.enabledMethods),
    defaultMethod: document.defaultMethod || null,
    allowSavedCard: !!document.allowSavedCard,
    scopeType: document.scopeType,
    scopeId: document.scopeId || null,
    updatedAt: document.updatedAt ? new Date(document.updatedAt).toISOString() : null,
    updatedBy,
  };
}

export const adminPaymentSettingsService = {
  async getCurrent(input?: {
    scopeType?: string;
    scopeId?: string | null;
  }) {
    const scope = normalizeScope(input?.scopeType, input?.scopeId);
    const trace = await paymentPolicyEngine.resolveWithTrace({
      cityId: scope.scopeType === "CITY" ? scope.scopeId : null,
      productId: scope.scopeType === "PRODUCT" ? scope.scopeId : null,
      operationId: scope.scopeType === "OPERATION" ? scope.scopeId : null,
    });

    const sourceDocument = trace.effectiveSource?.settings?._id
      ? await PaymentSettings.findById(trace.effectiveSource.settings._id)
          .populate("updatedBy", "name")
          .lean()
      : null;

    const updatedBy = sourceDocument?.updatedBy
      ? {
          id: String((sourceDocument.updatedBy as any)._id),
          name: (sourceDocument.updatedBy as any).name || null,
        }
      : null;

    return {
      provider: trace.policy.provider || "asaas",
      enabledMethods: trace.policy.enabledMethods,
      defaultMethod: trace.policy.defaultMethod,
      allowSavedCard: trace.policy.allowSavedCard,
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      updatedAt: sourceDocument?.updatedAt
        ? new Date(sourceDocument.updatedAt).toISOString()
        : null,
      updatedBy,
      isInherited: !!sourceDocument && (
        sourceDocument.scopeType !== scope.scopeType ||
        (sourceDocument.scopeId || null) !== (scope.scopeId || null)
      ),
      sourceScopeType: sourceDocument?.scopeType || scope.scopeType,
      sourceScopeId: sourceDocument?.scopeId || null,
    };
  },

  async upsert(
    rawInput: PaymentSettingsInput,
    adminUserId?: string,
  ) {
    const scope = normalizeScope(rawInput.scopeType, rawInput.scopeId);
    const normalized = validateInput({
      ...rawInput,
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
    });

    const existing = await PaymentSettings.findOne({
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
    }).lean();

    const nextPayload = {
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      provider: normalized.provider,
      enabledMethods: normalized.enabledMethods,
      defaultMethod: normalized.defaultMethod,
      allowSavedCard: normalized.allowSavedCard,
      pixEnabled: normalized.enabledMethods.includes("PIX"),
      creditCardEnabled: normalized.enabledMethods.includes("CREDIT_CARD"),
      updatedBy: adminUserId && mongoose.Types.ObjectId.isValid(adminUserId)
        ? new mongoose.Types.ObjectId(adminUserId)
        : null,
    };

    const document = await PaymentSettings.findOneAndUpdate(
      {
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
      },
      { $set: nextPayload },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    )
      .populate("updatedBy", "name")
      .lean();

    await AdminAuditLog.create({
      adminUserId:
        adminUserId && mongoose.Types.ObjectId.isValid(adminUserId)
          ? new mongoose.Types.ObjectId(adminUserId)
          : null,
      action: "PAYMENT_SETTINGS_UPDATED",
      targetType: "payment_settings",
      targetId: String(document?._id),
      details: {
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        before: existing
          ? {
              provider: existing.provider || null,
              enabledMethods: normalizeMethods(existing.enabledMethods),
              defaultMethod: existing.defaultMethod || null,
              allowSavedCard: !!existing.allowSavedCard,
            }
          : null,
        after: {
          provider: document?.provider || null,
          enabledMethods: normalizeMethods(document?.enabledMethods),
          defaultMethod: document?.defaultMethod || null,
          allowSavedCard: !!document?.allowSavedCard,
        },
      },
    });

    return {
      success: true,
      message: "Configuração de pagamento atualizada com sucesso.",
      data: await serializeSettings(document),
    };
  },

  async list() {
    const items = await PaymentSettings.find()
      .sort({ scopeType: 1, updatedAt: -1 })
      .lean();

    return {
      data: items.map((item) => ({
        id: String(item._id),
        scopeType: item.scopeType,
        scopeId: item.scopeId || null,
        provider: item.provider || "asaas",
        enabledMethods: normalizeMethods(item.enabledMethods),
        defaultMethod: item.defaultMethod || null,
        allowSavedCard: !!item.allowSavedCard,
        updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : null,
      })),
    };
  },

  async delete(id: string, adminUserId?: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AdminPaymentSettingsError(422, "VALIDATION_ERROR", "ID inválido.", {
        field: "id",
      });
    }

    const existing = await PaymentSettings.findByIdAndDelete(id).lean();
    if (!existing) {
      throw new AdminPaymentSettingsError(
        404,
        "NOT_FOUND",
        "Configuração não encontrada.",
      );
    }

    await AdminAuditLog.create({
      adminUserId:
        adminUserId && mongoose.Types.ObjectId.isValid(adminUserId)
          ? new mongoose.Types.ObjectId(adminUserId)
          : null,
      action: "PAYMENT_SETTINGS_DELETED",
      targetType: "payment_settings",
      targetId: id,
      details: {
        scopeType: existing.scopeType,
        scopeId: existing.scopeId || null,
        before: {
          provider: existing.provider || null,
          enabledMethods: normalizeMethods(existing.enabledMethods),
          defaultMethod: existing.defaultMethod || null,
          allowSavedCard: !!existing.allowSavedCard,
        },
        after: null,
      },
    });

    return {
      success: true,
      message: "Override removido com sucesso.",
    };
  },

  async listAuditLogs() {
    const logs = await AdminAuditLog.find({
      action: { $in: ["PAYMENT_SETTINGS_UPDATED", "PAYMENT_SETTINGS_DELETED"] },
      targetType: "payment_settings",
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("adminUserId", "name email")
      .lean();

    return {
      data: logs.map((log: any) => ({
        id: String(log._id),
        action: log.action,
        adminUserId: log.adminUserId ? String(log.adminUserId._id) : null,
        scopeType: log.details?.scopeType || null,
        scopeId: log.details?.scopeId || null,
        before: log.details?.before || null,
        after: log.details?.after || null,
        createdAt: log.createdAt ? new Date(log.createdAt).toISOString() : null,
        adminUser: log.adminUserId
          ? {
              id: String(log.adminUserId._id),
              name: log.adminUserId.name || null,
              email: log.adminUserId.email || null,
            }
          : null,
      })),
    };
  },
};

export { AdminPaymentSettingsError };
