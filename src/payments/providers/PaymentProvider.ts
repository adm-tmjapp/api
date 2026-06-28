export type PaymentProviderName = "asaas" | "stone" | "mock";
export type PaymentMethodType = "PIX" | "CREDIT_CARD";
export type PaymentEventStatus =
  | "PENDING"
  | "WAITING_PIX_PAYMENT"
  | "AUTHORIZED"
  | "PAID"
  | "FAILED"
  | "CANCELED"
  | "REFUNDED"
  | "CHARGEBACK";

export type PaymentProviderCustomerInput = {
  name: string;
  email: string;
  cpfCnpj?: string | null;
  mobilePhone?: string | null;
};

export type PaymentProviderCustomerResult = {
  providerCustomerId: string;
  raw: Record<string, unknown>;
};

export type PaymentProviderTokenizeCardInput = {
  providerCustomerId: string;
  card: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
};

export type PaymentProviderTokenizeCardResult = {
  providerPaymentMethodToken: string;
  brand?: string | null;
  last4?: string | null;
  raw: Record<string, unknown>;
};

export type PaymentProviderCreatePixInput = {
  providerCustomerId: string;
  externalReference: string;
  amount: number;
  description: string;
};

export type PaymentProviderCreatePixResult = {
  providerPaymentId: string;
  status: PaymentEventStatus;
  invoiceUrl?: string | null;
  pixPayload?: string | null;
  pixEncodedImage?: string | null;
  pixExpirationDate?: string | null;
  raw: Record<string, unknown>;
};

export type PaymentProviderCreateCardChargeInput = {
  providerCustomerId: string;
  providerPaymentMethodToken: string;
  externalReference: string;
  amount: number;
  description: string;
};

export type PaymentProviderCreateCardChargeResult = {
  providerPaymentId: string;
  status: PaymentEventStatus;
  invoiceUrl?: string | null;
  receiptUrl?: string | null;
  raw: Record<string, unknown>;
};

export type PaymentProviderWebhookEvent = {
  provider: PaymentProviderName;
  providerEvent: string;
  providerPaymentId?: string | null;
  status: PaymentEventStatus;
  amount?: number | null;
  paidAt?: string | null;
  raw: Record<string, unknown>;
};

export interface PaymentProvider {
  readonly name: PaymentProviderName;

  createCustomer(
    input: PaymentProviderCustomerInput,
  ): Promise<PaymentProviderCustomerResult>;

  tokenizeCard(
    input: PaymentProviderTokenizeCardInput,
  ): Promise<PaymentProviderTokenizeCardResult>;

  createPixCharge(
    input: PaymentProviderCreatePixInput,
  ): Promise<PaymentProviderCreatePixResult>;

  createCardCharge(
    input: PaymentProviderCreateCardChargeInput,
  ): Promise<PaymentProviderCreateCardChargeResult>;

  parseWebhook(payload: Record<string, unknown>): PaymentProviderWebhookEvent;
}
