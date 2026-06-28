import {
  PaymentEventStatus,
  PaymentProvider,
  PaymentProviderCreateCardChargeInput,
  PaymentProviderCreateCardChargeResult,
  PaymentProviderCreatePixInput,
  PaymentProviderCreatePixResult,
  PaymentProviderCustomerInput,
  PaymentProviderCustomerResult,
  PaymentProviderTokenizeCardInput,
  PaymentProviderTokenizeCardResult,
  PaymentProviderWebhookEvent,
} from "../PaymentProvider";

type AsaasApiOptions = {
  apiKey: string;
  baseUrl: string;
};

class AsaasApiError extends Error {
  statusCode: number;

  details?: unknown;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

function normalizeAsaasStatus(status?: string): PaymentEventStatus {
  const normalized = String(status || "").trim().toUpperCase();

  switch (normalized) {
    case "PENDING":
      return "PENDING";
    case "RECEIVED":
    case "CONFIRMED":
      return "PAID";
    case "RECEIVED_IN_CASH":
      return "PAID";
    case "AUTHORIZED":
      return "AUTHORIZED";
    case "REFUNDED":
      return "REFUNDED";
    case "CHARGEBACK_REQUESTED":
    case "CHARGEBACK_DISPUTE":
    case "AWAITING_CHARGEBACK_REVERSAL":
    case "DUNNING_REQUESTED":
      return "CHARGEBACK";
    case "OVERDUE":
    case "FAILED":
      return "FAILED";
    case "CANCELED":
      return "CANCELED";
    default:
      return "PENDING";
  }
}

async function parseAsaasResponse(response: Response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new AsaasApiError(
      `Asaas request failed with status ${response.status}`,
      response.status,
      data,
    );
  }

  return data as Record<string, unknown>;
}

export class AsaasPaymentProvider implements PaymentProvider {
  readonly name = "asaas" as const;

  private readonly apiKey: string;

  private readonly baseUrl: string;

  constructor(options: Partial<AsaasApiOptions> = {}) {
    this.apiKey = options.apiKey || String(process.env.ASAAS_API_KEY || "").trim();
    this.baseUrl = (
      options.baseUrl ||
      process.env.ASAAS_BASE_URL ||
      "https://sandbox.asaas.com/api/v3"
    ).replace(/\/$/, "");

    if (!this.apiKey) {
      throw new Error("ASAAS_API_KEY não configurada.");
    }
  }

  private async request(path: string, init?: RequestInit) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        access_token: this.apiKey,
        ...(init?.headers || {}),
      },
    });

    return parseAsaasResponse(response);
  }

  async createCustomer(
    input: PaymentProviderCustomerInput,
  ): Promise<PaymentProviderCustomerResult> {
    const raw = await this.request("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        email: input.email,
        cpfCnpj: input.cpfCnpj || undefined,
        mobilePhone: input.mobilePhone || undefined,
      }),
    });

    return {
      providerCustomerId: String(raw.id),
      raw,
    };
  }

  async tokenizeCard(
    input: PaymentProviderTokenizeCardInput,
  ): Promise<PaymentProviderTokenizeCardResult> {
    const raw = await this.request("/creditCard/tokenize", {
      method: "POST",
      body: JSON.stringify({
        customer: input.providerCustomerId,
        creditCard: {
          holderName: input.card.holderName,
          number: input.card.number,
          expiryMonth: input.card.expiryMonth,
          expiryYear: input.card.expiryYear,
          ccv: input.card.ccv,
        },
      }),
    });

    const token =
      String(raw.creditCardToken || raw.token || raw.id || "").trim();

    if (!token) {
      throw new Error("Asaas não retornou token do cartão.");
    }

    return {
      providerPaymentMethodToken: token,
      brand: raw.creditCardBrand ? String(raw.creditCardBrand) : null,
      last4: raw.last4 ? String(raw.last4) : input.card.number.slice(-4),
      raw,
    };
  }

  async createPixCharge(
    input: PaymentProviderCreatePixInput,
  ): Promise<PaymentProviderCreatePixResult> {
    const paymentRaw = await this.request("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: input.providerCustomerId,
        billingType: "PIX",
        value: input.amount,
        description: input.description,
        externalReference: input.externalReference,
      }),
    });

    const providerPaymentId = String(paymentRaw.id);
    const qrCodeRaw = await this.request(`/payments/${providerPaymentId}/pixQrCode`, {
      method: "GET",
    });

    return {
      providerPaymentId,
      status: "WAITING_PIX_PAYMENT",
      invoiceUrl: paymentRaw.invoiceUrl ? String(paymentRaw.invoiceUrl) : null,
      pixPayload: qrCodeRaw.payload ? String(qrCodeRaw.payload) : null,
      pixEncodedImage: qrCodeRaw.encodedImage
        ? String(qrCodeRaw.encodedImage)
        : null,
      pixExpirationDate: qrCodeRaw.expirationDate
        ? String(qrCodeRaw.expirationDate)
        : null,
      raw: {
        payment: paymentRaw,
        pixQrCode: qrCodeRaw,
      },
    };
  }

  async createCardCharge(
    input: PaymentProviderCreateCardChargeInput,
  ): Promise<PaymentProviderCreateCardChargeResult> {
    const raw = await this.request("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: input.providerCustomerId,
        billingType: "CREDIT_CARD",
        value: input.amount,
        description: input.description,
        externalReference: input.externalReference,
        creditCardToken: input.providerPaymentMethodToken,
      }),
    });

    return {
      providerPaymentId: String(raw.id),
      status: normalizeAsaasStatus(String(raw.status || "")),
      invoiceUrl: raw.invoiceUrl ? String(raw.invoiceUrl) : null,
      receiptUrl: raw.transactionReceiptUrl
        ? String(raw.transactionReceiptUrl)
        : null,
      raw,
    };
  }

  parseWebhook(payload: Record<string, unknown>): PaymentProviderWebhookEvent {
    const payment = (payload.payment || payload) as Record<string, unknown>;

    return {
      provider: this.name,
      providerEvent: String(payload.event || payment.status || "UNKNOWN"),
      providerPaymentId: payment.id ? String(payment.id) : null,
      status: normalizeAsaasStatus(String(payment.status || payload.event || "")),
      amount:
        typeof payment.value === "number"
          ? payment.value
          : payment.value
            ? Number(payment.value)
            : null,
      paidAt: payment.paymentDate ? String(payment.paymentDate) : null,
      raw: payload,
    };
  }
}
