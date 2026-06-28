import PaymentSettings from "../../models/PaymentSettings";
import { PaymentMethodType } from "../providers/PaymentProvider";

type PaymentPolicyContext = {
  cityId?: string | null;
  productId?: string | null;
  operationId?: string | null;
};

type PolicySource = {
  scopeType: "GLOBAL" | "CITY" | "PRODUCT" | "OPERATION";
  scopeId?: string | null;
  settings?: any;
};

export type ResolvedPaymentPolicy = {
  enabledMethods: PaymentMethodType[];
  defaultMethod: PaymentMethodType | null;
  allowSavedCard: boolean;
  provider: string | null;
  providerStrategy: string | null;
  providerPriority: number | null;
};

function normalizeMethods(input: string[] | undefined) {
  const methods = (input || [])
    .map((item) => String(item).trim().toUpperCase())
    .filter((item): item is PaymentMethodType =>
      item === "PIX" || item === "CREDIT_CARD",
    );

  return [...new Set(methods)];
}

function mergePolicy(
  base: ResolvedPaymentPolicy,
  settings?: any,
): ResolvedPaymentPolicy {
  if (!settings) return base;

  const enabledMethods = normalizeMethods(settings.enabledMethods);
  const nextEnabledMethods = enabledMethods.length ? enabledMethods : base.enabledMethods;
  const rawDefaultMethod = String(settings.defaultMethod || "").trim().toUpperCase();
  const nextDefaultMethod = nextEnabledMethods.includes(rawDefaultMethod as PaymentMethodType)
    ? (rawDefaultMethod as PaymentMethodType)
    : nextEnabledMethods.includes(base.defaultMethod as PaymentMethodType)
      ? base.defaultMethod
      : nextEnabledMethods[0] || null;

  return {
    enabledMethods: nextEnabledMethods,
    defaultMethod: nextDefaultMethod,
    allowSavedCard:
      typeof settings.allowSavedCard === "boolean"
        ? settings.allowSavedCard
        : base.allowSavedCard,
    provider: settings.provider || base.provider,
    providerStrategy: settings.providerStrategy || base.providerStrategy,
    providerPriority:
      typeof settings.providerPriority === "number"
        ? settings.providerPriority
        : base.providerPriority,
  };
}

async function loadScopeSettings(context: PaymentPolicyContext = {}) {
  const [global, city, product, operation] = await Promise.all([
    PaymentSettings.findOne({ scopeType: "GLOBAL", scopeId: null }).lean(),
    context.cityId
      ? PaymentSettings.findOne({ scopeType: "CITY", scopeId: context.cityId }).lean()
      : null,
    context.productId
      ? PaymentSettings.findOne({
          scopeType: "PRODUCT",
          scopeId: context.productId,
        }).lean()
      : null,
    context.operationId
      ? PaymentSettings.findOne({
          scopeType: "OPERATION",
          scopeId: context.operationId,
        }).lean()
      : null,
  ]);

  return [
    { scopeType: "GLOBAL" as const, scopeId: null, settings: global },
    { scopeType: "CITY" as const, scopeId: context.cityId || null, settings: city },
    {
      scopeType: "PRODUCT" as const,
      scopeId: context.productId || null,
      settings: product,
    },
    {
      scopeType: "OPERATION" as const,
      scopeId: context.operationId || null,
      settings: operation,
    },
  ] satisfies PolicySource[];
}

export const paymentPolicyEngine = {
  async resolve(context: PaymentPolicyContext = {}): Promise<ResolvedPaymentPolicy> {
    const initial: ResolvedPaymentPolicy = {
      enabledMethods: ["PIX", "CREDIT_CARD"],
      defaultMethod: "PIX",
      allowSavedCard: false,
      provider: process.env.DEFAULT_PAYMENT_PROVIDER || "asaas",
      providerStrategy: "DEFAULT",
      providerPriority: 1,
    };

    const sources = await loadScopeSettings(context);

    return sources.reduce(
      (acc, source) => mergePolicy(acc, source.settings),
      initial,
    );
  },

  async resolveWithTrace(context: PaymentPolicyContext = {}) {
    const initial: ResolvedPaymentPolicy = {
      enabledMethods: ["PIX", "CREDIT_CARD"],
      defaultMethod: "PIX",
      allowSavedCard: false,
      provider: process.env.DEFAULT_PAYMENT_PROVIDER || "asaas",
      providerStrategy: "DEFAULT",
      providerPriority: 1,
    };

    const sources = await loadScopeSettings(context);
    const policy = sources.reduce(
      (acc, source) => mergePolicy(acc, source.settings),
      initial,
    );

    const appliedSources = sources.filter((source) => !!source.settings);
    const effectiveSource = appliedSources.length
      ? appliedSources[appliedSources.length - 1]
      : null;

    return {
      policy,
      effectiveSource,
      sources,
    };
  },

  assertMethodEnabled(
    policy: ResolvedPaymentPolicy,
    method: PaymentMethodType,
  ) {
    if (!policy.enabledMethods.includes(method)) {
      const error = new Error(
        "Forma de pagamento indisponível para esta operação.",
      ) as Error & {
        statusCode?: number;
        code?: string;
      };

      error.statusCode = 422;
      error.code = "PAYMENT_METHOD_DISABLED";
      throw error;
    }
  },

  assertSavedCardAllowed(policy: ResolvedPaymentPolicy) {
    if (!policy.allowSavedCard) {
      const error = new Error(
        "Forma de pagamento indisponível para esta operação.",
      ) as Error & {
        statusCode?: number;
        code?: string;
      };

      error.statusCode = 422;
      error.code = "PAYMENT_METHOD_DISABLED";
      throw error;
    }
  },
};
