import mongoose from "mongoose";
import PaymentGatewayCustomer from "../../models/PaymentGatewayCustomer";
import PassengerPaymentMethod from "../../models/PassengerPaymentMethod";
import RidePayment from "../../models/RidePayment";
import Ride from "../../models/Ride";
import User from "../../models/User";
import { paymentPolicyEngine } from "./PaymentPolicyEngine";
import { createPaymentProvider } from "../providers/PaymentProviderFactory";

type EnsureCustomerInput = {
  userId: string;
  provider?: string | null;
};

type TokenizeCardInput = {
  userId: string;
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
  label?: string | null;
  setAsDefault?: boolean;
};

type CreatePixPaymentInput = {
  rideId: string;
  passengerId: string;
  driverId?: string | null;
  amount: number;
  description: string;
  cityId?: string | null;
  productId?: string | null;
  operationId?: string | null;
};

type CardDetailsInput = {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
};

type CreateCardPaymentInput = {
  rideId: string;
  passengerId: string;
  driverId?: string | null;
  amount: number;
  description: string;
  cityId?: string | null;
  productId?: string | null;
  operationId?: string | null;
  savedPaymentMethodId?: string | null;
  card?: CardDetailsInput | null;
  saveCard?: boolean;
  setAsDefault?: boolean;
  label?: string | null;
};

function ensureValidObjectId(value: string, message: string) {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    const error = new Error(message) as Error & {
      statusCode?: number;
      code?: string;
    };
    error.statusCode = 422;
    error.code = "VALIDATION_ERROR";
    throw error;
  }
}

function ensureRequiredCardFields(card: CardDetailsInput | null | undefined) {
  const missing: string[] = [];

  if (!card?.holderName?.trim()) missing.push("holderName");
  if (!card?.number?.trim()) missing.push("number");
  if (!card?.expiryMonth?.trim()) missing.push("expiryMonth");
  if (!card?.expiryYear?.trim()) missing.push("expiryYear");
  if (!card?.ccv?.trim()) missing.push("ccv");

  if (missing.length) {
    const error = new Error("Dados do cartão são obrigatórios.") as Error & {
      statusCode?: number;
      code?: string;
      details?: Record<string, unknown>;
    };
    error.statusCode = 422;
    error.code = "VALIDATION_ERROR";
    error.details = { missingFields: missing };
    throw error;
  }
}

function assertCardDetails(card: CardDetailsInput | null | undefined): CardDetailsInput {
  ensureRequiredCardFields(card);
  return card as CardDetailsInput;
}

export const paymentOrchestrator = {
  async getPaymentOptions(context: {
    rideId?: string | null;
    cityId?: string | null;
    productId?: string | null;
    operationId?: string | null;
  }) {
    let rideContext = {
      cityId: context.cityId || null,
      productId: context.productId || null,
      operationId: context.operationId || null,
    };

    if (context.rideId && !rideContext.productId) {
      const ride = await Ride.findById(context.rideId).lean();
      rideContext = {
        cityId: rideContext.cityId,
        productId: rideContext.productId || ((ride as any)?.product?.id as string) || null,
        operationId: rideContext.operationId,
      };
    }

    const policy = await paymentPolicyEngine.resolve({
      cityId: rideContext.cityId,
      productId: rideContext.productId,
      operationId: rideContext.operationId,
    });

    return {
      enabledMethods: [
        {
          type: "PIX",
          enabled: policy.enabledMethods.includes("PIX"),
          label: "PIX",
          reason: policy.enabledMethods.includes("PIX")
            ? null
            : "Forma de pagamento temporariamente indisponível.",
        },
        {
          type: "CREDIT_CARD",
          enabled: policy.enabledMethods.includes("CREDIT_CARD"),
          label: "Cartão de Crédito",
          reason: policy.enabledMethods.includes("CREDIT_CARD")
            ? null
            : "Forma de pagamento temporariamente indisponível.",
        },
      ],
      defaultMethod: policy.defaultMethod,
      allowSavedCard: policy.allowSavedCard,
      provider: policy.provider,
      rideId: context.rideId || null,
    };
  },

  async ensureProviderCustomer(input: EnsureCustomerInput) {
    const policy = await paymentPolicyEngine.resolve();
    const providerName = input.provider || policy.provider || "asaas";
    const provider = createPaymentProvider(providerName);

    const existing = await PaymentGatewayCustomer.findOne({
      userId: new mongoose.Types.ObjectId(input.userId),
      provider: provider.name,
    });

    if (existing) {
      return existing;
    }

    const user = await User.findById(input.userId).lean();
    if (!user) {
      throw new Error("Usuário não encontrado para criar customer no gateway.");
    }

    const created = await provider.createCustomer({
      name: user.name,
      email: user.email,
      cpfCnpj: user.cpf || null,
      mobilePhone: user.phone || null,
    });

    return PaymentGatewayCustomer.create({
      userId: new mongoose.Types.ObjectId(input.userId),
      provider: provider.name,
      providerCustomerId: created.providerCustomerId,
      metadata: created.raw,
    });
  },

  async tokenizePassengerCard(input: TokenizeCardInput) {
    const policy = await paymentPolicyEngine.resolve();
    paymentPolicyEngine.assertMethodEnabled(policy, "CREDIT_CARD");
    paymentPolicyEngine.assertSavedCardAllowed(policy);
    ensureRequiredCardFields(input);

    const provider = createPaymentProvider(policy.provider);
    const gatewayCustomer = await this.ensureProviderCustomer({
      userId: input.userId,
      provider: provider.name,
    });

    const tokenized = await provider.tokenizeCard({
      providerCustomerId: gatewayCustomer.providerCustomerId,
      card: {
        holderName: input.holderName,
        number: input.number,
        expiryMonth: input.expiryMonth,
        expiryYear: input.expiryYear,
        ccv: input.ccv,
      },
    });

    if (input.setAsDefault) {
      await PassengerPaymentMethod.updateMany(
        {
          passengerUserId: gatewayCustomer.userId,
        },
        { $set: { isDefault: false } },
      );
    }

    return PassengerPaymentMethod.create({
      passengerUserId: gatewayCustomer.userId,
      type: "card",
      brand: tokenized.brand || undefined,
      last4: tokenized.last4 || undefined,
      holderName: input.holderName,
      isDefault: !!input.setAsDefault,
      provider: provider.name,
      providerCustomerId: gatewayCustomer.providerCustomerId,
      providerPaymentMethodToken: tokenized.providerPaymentMethodToken,
      label: input.label || null,
      status: "ACTIVE",
    } as any);
  },

  async createPixRidePayment(input: CreatePixPaymentInput) {
    ensureValidObjectId(input.rideId, "Ride inválida.");
    ensureValidObjectId(input.passengerId, "Passageiro inválido.");

    const ride = await Ride.findById(input.rideId).lean();
    if (!ride) {
      const error = new Error("Corrida não encontrada.") as Error & {
        statusCode?: number;
        code?: string;
      };
      error.statusCode = 404;
      error.code = "RIDE_NOT_FOUND";
      throw error;
    }

    const policy = await paymentPolicyEngine.resolve({
      cityId: input.cityId,
      productId: input.productId,
      operationId: input.operationId,
    });

    paymentPolicyEngine.assertMethodEnabled(policy, "PIX");

    const provider = createPaymentProvider(policy.provider);
    const gatewayCustomer = await this.ensureProviderCustomer({
      userId: input.passengerId,
      provider: provider.name,
    });

    const providerCharge = await provider.createPixCharge({
      providerCustomerId: gatewayCustomer.providerCustomerId,
      externalReference: input.rideId,
      amount: input.amount,
      description: input.description,
    });

    return RidePayment.create({
      rideId: new mongoose.Types.ObjectId(input.rideId),
      passengerId: new mongoose.Types.ObjectId(input.passengerId),
      driverId: input.driverId ? new mongoose.Types.ObjectId(input.driverId) : null,
      provider: provider.name,
      providerPaymentId: providerCharge.providerPaymentId,
      providerCustomerId: gatewayCustomer.providerCustomerId,
      billingType: "PIX",
      status: providerCharge.status,
      grossAmount: input.amount,
      platformCommissionAmount: 0,
      providerFeeAmount: 0,
      driverNetAmount: 0,
      platformNetAmount: 0,
      invoiceUrl: providerCharge.invoiceUrl || null,
      pixPayload: providerCharge.pixPayload || null,
      pixEncodedImage: providerCharge.pixEncodedImage || null,
      pixExpirationDate: providerCharge.pixExpirationDate
        ? new Date(providerCharge.pixExpirationDate)
        : null,
      providerPayload: providerCharge.raw,
    });
  },

  async createCardRidePayment(input: CreateCardPaymentInput) {
    ensureValidObjectId(input.rideId, "Ride inválida.");
    ensureValidObjectId(input.passengerId, "Passageiro inválido.");

    const ride = await Ride.findById(input.rideId).lean();
    if (!ride) {
      const error = new Error("Corrida não encontrada.") as Error & {
        statusCode?: number;
        code?: string;
      };
      error.statusCode = 404;
      error.code = "RIDE_NOT_FOUND";
      throw error;
    }

    const policy = await paymentPolicyEngine.resolve({
      cityId: input.cityId,
      productId: input.productId,
      operationId: input.operationId,
    });

    paymentPolicyEngine.assertMethodEnabled(policy, "CREDIT_CARD");

    const provider = createPaymentProvider(policy.provider);
    const gatewayCustomer = await this.ensureProviderCustomer({
      userId: input.passengerId,
      provider: provider.name,
    });

    let paymentMethodDoc: any = null;
    let providerPaymentMethodToken = "";
    let savedPaymentMethodId = input.savedPaymentMethodId || null;

    if (input.saveCard || savedPaymentMethodId) {
      paymentPolicyEngine.assertSavedCardAllowed(policy);
    }

    if (!savedPaymentMethodId && !input.card) {
      const defaultMethod = await PassengerPaymentMethod.findOne({
        passengerUserId: new mongoose.Types.ObjectId(input.passengerId),
        type: "card",
        status: "ACTIVE",
      }).sort({ isDefault: -1, createdAt: -1 });

      savedPaymentMethodId = defaultMethod ? String(defaultMethod._id) : null;
    }

    if (savedPaymentMethodId) {
      paymentPolicyEngine.assertSavedCardAllowed(policy);
      ensureValidObjectId(savedPaymentMethodId, "Método de pagamento inválido.");

      paymentMethodDoc = await PassengerPaymentMethod.findOne({
        _id: new mongoose.Types.ObjectId(savedPaymentMethodId),
        passengerUserId: new mongoose.Types.ObjectId(input.passengerId),
        type: "card",
        status: "ACTIVE",
      });

      if (!paymentMethodDoc) {
        const error = new Error("Método de pagamento não encontrado.") as Error & {
          statusCode?: number;
          code?: string;
        };
        error.statusCode = 404;
        error.code = "PAYMENT_METHOD_NOT_FOUND";
        throw error;
      }

      providerPaymentMethodToken = String(
        paymentMethodDoc.providerPaymentMethodToken || "",
      ).trim();
    } else {
      const card = assertCardDetails(input.card);

      const tokenized = await provider.tokenizeCard({
        providerCustomerId: gatewayCustomer.providerCustomerId,
        card,
      });

      providerPaymentMethodToken = tokenized.providerPaymentMethodToken;

      if (input.saveCard) {
        if (input.setAsDefault) {
          await PassengerPaymentMethod.updateMany(
            {
              passengerUserId: gatewayCustomer.userId,
            },
            { $set: { isDefault: false } },
          );
        }

        paymentMethodDoc = await PassengerPaymentMethod.create({
          passengerUserId: gatewayCustomer.userId,
          type: "card",
          brand: tokenized.brand || undefined,
          last4: tokenized.last4 || undefined,
          holderName: card.holderName,
          isDefault: !!input.setAsDefault,
          provider: provider.name,
          providerCustomerId: gatewayCustomer.providerCustomerId,
          providerPaymentMethodToken: tokenized.providerPaymentMethodToken,
          label: input.label || null,
          status: "ACTIVE",
        } as any);
      }
    }

    if (!providerPaymentMethodToken) {
      const error = new Error("Token do cartão não encontrado.") as Error & {
        statusCode?: number;
        code?: string;
      };
      error.statusCode = 422;
      error.code = "VALIDATION_ERROR";
      throw error;
    }

    const providerCharge = await provider.createCardCharge({
      providerCustomerId: gatewayCustomer.providerCustomerId,
      providerPaymentMethodToken,
      externalReference: input.rideId,
      amount: input.amount,
      description: input.description,
    });

    return RidePayment.create({
      rideId: new mongoose.Types.ObjectId(input.rideId),
      passengerId: new mongoose.Types.ObjectId(input.passengerId),
      driverId: input.driverId ? new mongoose.Types.ObjectId(input.driverId) : null,
      provider: provider.name,
      providerPaymentId: providerCharge.providerPaymentId,
      providerCustomerId: gatewayCustomer.providerCustomerId,
      paymentMethodId: paymentMethodDoc?._id || null,
      billingType: "CREDIT_CARD",
      status: providerCharge.status,
      grossAmount: input.amount,
      platformCommissionAmount: 0,
      providerFeeAmount: 0,
      driverNetAmount: 0,
      platformNetAmount: 0,
      invoiceUrl: providerCharge.invoiceUrl || null,
      receiptUrl: providerCharge.receiptUrl || null,
      providerPayload: providerCharge.raw,
      paidAt: providerCharge.status === "PAID" ? new Date() : null,
    });
  },

  async getRidePaymentStatus(input: { rideId: string; passengerId: string }) {
    ensureValidObjectId(input.rideId, "Ride inválida.");
    ensureValidObjectId(input.passengerId, "Passageiro inválido.");

    const payment = await RidePayment.findOne({
      rideId: new mongoose.Types.ObjectId(input.rideId),
      passengerId: new mongoose.Types.ObjectId(input.passengerId),
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!payment) {
      const error = new Error("Pagamento não encontrado.") as Error & {
        statusCode?: number;
        code?: string;
      };
      error.statusCode = 404;
      error.code = "PAYMENT_NOT_FOUND";
      throw error;
    }

    return {
      paymentId: String(payment._id),
      rideId: String(payment.rideId),
      provider: payment.provider,
      billingType: payment.billingType,
      status: payment.status,
      grossAmount: payment.grossAmount,
      pix: payment.billingType === "PIX"
        ? {
            payload: payment.pixPayload || null,
            encodedImage: payment.pixEncodedImage || null,
            expirationDate: payment.pixExpirationDate
              ? payment.pixExpirationDate.toISOString()
              : null,
          }
        : null,
      invoiceUrl: payment.invoiceUrl || null,
      paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
    };
  },

  async getRidePaymentReceipt(input: { rideId: string; passengerId: string }) {
    ensureValidObjectId(input.rideId, "Ride inválida.");
    ensureValidObjectId(input.passengerId, "Passageiro inválido.");

    const [payment, ride] = await Promise.all([
      RidePayment.findOne({
        rideId: new mongoose.Types.ObjectId(input.rideId),
        passengerId: new mongoose.Types.ObjectId(input.passengerId),
      })
        .sort({ createdAt: -1 })
        .lean(),
      Ride.findById(input.rideId).lean(),
    ]);

    if (!payment) {
      const error = new Error("Pagamento não encontrado.") as Error & {
        statusCode?: number;
        code?: string;
      };
      error.statusCode = 404;
      error.code = "PAYMENT_NOT_FOUND";
      throw error;
    }

    return {
      paymentId: String(payment._id),
      rideId: String(payment.rideId),
      provider: payment.provider,
      providerPaymentId: payment.providerPaymentId || null,
      billingType: payment.billingType,
      status: payment.status,
      paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
      grossAmount: payment.grossAmount,
      platformCommissionAmount: payment.platformCommissionAmount,
      providerFeeAmount: payment.providerFeeAmount,
      driverNetAmount: payment.driverNetAmount,
      platformNetAmount: payment.platformNetAmount,
      originAddress: (ride as any)?.pickup_location?.address || null,
      destinationAddress: (ride as any)?.destination_location?.address || null,
      invoiceUrl: payment.invoiceUrl || null,
      receiptUrl: payment.receiptUrl || null,
    };
  },
};
