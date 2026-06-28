import { Request, Response } from "express";
import { paymentOrchestrator } from "../../payments/application/PaymentOrchestrator";
import { paymentWebhookProcessor } from "../../payments/application/PaymentWebhookProcessor";
import Ride from "../../models/Ride";

function handleError(res: Response, error: unknown, fallbackMessage: string) {
  const typed = error as Error & {
    statusCode?: number;
    code?: string;
    details?: Record<string, unknown>;
  };

  res.status(typed.statusCode || 500).json({
    statusCode: typed.statusCode || 500,
    error: typed.code || "INTERNAL_ERROR",
    message: typed.message || fallbackMessage,
    details: typed.details || {},
  });
}

export const paymentV2Controller = {
  async getPassengerPaymentOptions(req: Request, res: Response) {
    try {
      const rideId =
        typeof req.query.rideId === "string" ? req.query.rideId : undefined;
      const cityId =
        typeof req.query.cityId === "string" ? req.query.cityId : undefined;
      const productId =
        typeof req.query.productId === "string" ? req.query.productId : undefined;
      const operationId =
        typeof req.query.operationId === "string" ? req.query.operationId : undefined;

      const payload = await paymentOrchestrator.getPaymentOptions({
        rideId,
        cityId,
        productId,
        operationId,
      });
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error, "Erro ao consultar meios de pagamento.");
    }
  },

  async createPassengerPixPayment(req: Request, res: Response) {
    try {
      const passengerId = req.user?.id as string;
      const rideId = req.params.rideId as string;

      const ride = await Ride.findById(rideId).lean();
      if (!ride) {
        res.status(404).json({
          statusCode: 404,
          error: "RIDE_NOT_FOUND",
          message: "Corrida não encontrada.",
          details: {},
        });
        return;
      }

      const amount = Number(
        req.body?.amount ??
          (ride as any)?.fare?.total_amount ??
          (ride as any)?.product?.price ??
          0,
      );

      const payload = await paymentOrchestrator.createPixRidePayment({
        rideId,
        passengerId,
        driverId: ((ride as any)?.driver?.id as string) || null,
        amount,
        description:
          req.body?.description ||
          `Pagamento da corrida ${rideId}`,
        productId: ((ride as any)?.product?.id as string) || null,
      });

      res.status(201).json({
        paymentId: String(payload._id),
        rideId: String(payload.rideId),
        provider: payload.provider,
        billingType: payload.billingType,
        status: payload.status,
        grossAmount: payload.grossAmount,
        pix: {
          payload: payload.pixPayload,
          encodedImage: payload.pixEncodedImage,
          expirationDate: payload.pixExpirationDate
            ? payload.pixExpirationDate.toISOString()
            : null,
        },
        invoiceUrl: payload.invoiceUrl,
      });
    } catch (error) {
      handleError(res, error, "Erro ao gerar pagamento PIX.");
    }
  },

  async tokenizePassengerCard(req: Request, res: Response) {
    try {
      const passengerId = req.user?.id as string;
      const payload = await paymentOrchestrator.tokenizePassengerCard({
        userId: passengerId,
        holderName: String(req.body?.holderName || "").trim(),
        number: String(req.body?.number || "").trim(),
        expiryMonth: String(req.body?.expiryMonth || "").trim(),
        expiryYear: String(req.body?.expiryYear || "").trim(),
        ccv: String(req.body?.ccv || "").trim(),
        label: req.body?.label ? String(req.body.label).trim() : null,
        setAsDefault: !!req.body?.setAsDefault,
      });

      res.status(201).json({
        id: String(payload._id),
        type: payload.type,
        brand: payload.brand || null,
        last4: payload.last4 || null,
        holderName: payload.holderName || null,
        label: payload.label || null,
        isDefault: !!payload.isDefault,
        provider: payload.provider || null,
        status: payload.status || null,
      });
    } catch (error) {
      handleError(res, error, "Erro ao salvar cartão.");
    }
  },

  async createPassengerCardPayment(req: Request, res: Response) {
    try {
      const passengerId = req.user?.id as string;
      const rideId = req.params.rideId as string;

      const ride = await Ride.findById(rideId).lean();
      if (!ride) {
        res.status(404).json({
          statusCode: 404,
          error: "RIDE_NOT_FOUND",
          message: "Corrida não encontrada.",
          details: {},
        });
        return;
      }

      const amount = Number(
        req.body?.amount ??
          (ride as any)?.fare?.total_amount ??
          (ride as any)?.product?.price ??
          0,
      );

      const payload = await paymentOrchestrator.createCardRidePayment({
        rideId,
        passengerId,
        driverId: ((ride as any)?.driver?.id as string) || null,
        amount,
        description: req.body?.description || `Pagamento da corrida ${rideId}`,
        productId: ((ride as any)?.product?.id as string) || null,
        savedPaymentMethodId: req.body?.paymentMethodId || null,
        saveCard: !!req.body?.saveCard,
        setAsDefault: !!req.body?.setAsDefault,
        label: req.body?.label ? String(req.body.label).trim() : null,
        card: req.body?.paymentMethodId
          ? null
          : {
              holderName: String(req.body?.holderName || "").trim(),
              number: String(req.body?.number || "").trim(),
              expiryMonth: String(req.body?.expiryMonth || "").trim(),
              expiryYear: String(req.body?.expiryYear || "").trim(),
              ccv: String(req.body?.ccv || "").trim(),
            },
      });

      res.status(201).json({
        paymentId: String(payload._id),
        rideId: String(payload.rideId),
        provider: payload.provider,
        billingType: payload.billingType,
        status: payload.status,
        grossAmount: payload.grossAmount,
        invoiceUrl: payload.invoiceUrl || null,
        receiptUrl: payload.receiptUrl || null,
        paidAt: payload.paidAt ? payload.paidAt.toISOString() : null,
        paymentMethodId: payload.paymentMethodId ? String(payload.paymentMethodId) : null,
      });
    } catch (error) {
      handleError(res, error, "Erro ao processar pagamento com cartão.");
    }
  },

  async getPassengerRidePaymentStatus(req: Request, res: Response) {
    try {
      const payload = await paymentOrchestrator.getRidePaymentStatus({
        rideId: req.params.rideId as string,
        passengerId: req.user?.id as string,
      });
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error, "Erro ao consultar status do pagamento.");
    }
  },

  async getPassengerRidePaymentReceipt(req: Request, res: Response) {
    try {
      const payload = await paymentOrchestrator.getRidePaymentReceipt({
        rideId: req.params.rideId as string,
        passengerId: req.user?.id as string,
      });
      res.status(200).json(payload);
    } catch (error) {
      handleError(res, error, "Erro ao consultar comprovante do pagamento.");
    }
  },

  async handleAsaasWebhook(req: Request, res: Response) {
    try {
      const payload = await paymentWebhookProcessor.process("asaas", req.body || {});
      res.status(200).json({
        success: true,
        normalizedStatus: payload.normalizedStatus,
        ridePaymentId: payload.ridePayment ? String(payload.ridePayment._id) : null,
        eventId: String(payload.event._id),
      });
    } catch (error) {
      handleError(res, error, "Erro ao processar webhook da Asaas.");
    }
  },
};
