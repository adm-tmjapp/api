import { AsaasPaymentProvider } from "./asaas/AsaasPaymentProvider";
import { PaymentProvider, PaymentProviderName } from "./PaymentProvider";

export function createPaymentProvider(
  providerName?: string | null,
): PaymentProvider {
  const normalized = String(
    providerName || process.env.DEFAULT_PAYMENT_PROVIDER || "asaas",
  )
    .trim()
    .toLowerCase() as PaymentProviderName;

  switch (normalized) {
    case "asaas":
      return new AsaasPaymentProvider();
    case "stone":
      throw new Error("StonePaymentProvider ainda não implementado.");
    case "mock":
      throw new Error("MockPaymentProvider ainda não implementado.");
    default:
      throw new Error(`Provider de pagamento não suportado: ${normalized}`);
  }
}
