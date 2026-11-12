import RidePayment from "../../models/RidePayment";
import RidePaymentEvent from "../../models/RidePaymentEvent";
import { createPaymentProvider } from "../providers/PaymentProviderFactory";
import { paymentOrchestrator } from "./PaymentOrchestrator";

export const paymentWebhookProcessor = {
  async process(providerName: string, payload: Record<string, unknown>) {
    const provider = createPaymentProvider(providerName);
    const event = provider.parseWebhook(payload);

    if (event.providerEventId) {
      const alreadyProcessed = await RidePaymentEvent.findOne({
        provider: provider.name,
        providerEventId: event.providerEventId,
      });
      if (alreadyProcessed) {
        return {
          event: alreadyProcessed,
          ridePayment: event.providerPaymentId
            ? await RidePayment.findOne({
                provider: provider.name,
                providerPaymentId: event.providerPaymentId,
              })
            : null,
          normalizedStatus: event.status,
          duplicate: true,
        };
      }
    }

    const ridePayment = event.providerPaymentId
      ? await RidePayment.findOne({
          provider: provider.name,
          providerPaymentId: event.providerPaymentId,
        })
      : null;

    if (!ridePayment && event.providerPaymentId) {
      console.warn("[payment-webhook] payment not found for provider event", {
        provider: provider.name,
        providerEvent: event.providerEvent,
        providerPaymentId: event.providerPaymentId,
      });
    }

    let storedEvent;
    try {
      storedEvent = await RidePaymentEvent.create({
        ridePaymentId: ridePayment?._id || null,
        provider: provider.name,
        providerEvent: event.providerEvent,
        providerPaymentId: event.providerPaymentId || null,
        providerEventId: event.providerEventId || null,
        payload: event.raw,
        processed: true,
        processedAt: new Date(),
      });
    } catch (error: any) {
      if (error?.code !== 11000 || !event.providerEventId) throw error;
      const duplicateEvent = await RidePaymentEvent.findOne({
        provider: provider.name,
        providerEventId: event.providerEventId,
      });
      if (!duplicateEvent) throw error;
      return {
        event: duplicateEvent,
        ridePayment: event.providerPaymentId
          ? await RidePayment.findOne({
              provider: provider.name,
              providerPaymentId: event.providerPaymentId,
            })
          : null,
        normalizedStatus: event.status,
        duplicate: true,
      };
    }

    if (ridePayment) {
      ridePayment.status = event.status;
      if (event.paidAt) {
        ridePayment.paidAt = new Date(event.paidAt);
      }
      ridePayment.providerPayload = event.raw;
      await ridePayment.save();
      console.info("[payment-webhook] payment status updated", {
        provider: provider.name,
        providerEvent: event.providerEvent,
        providerPaymentId: event.providerPaymentId,
        ridePaymentId: String(ridePayment._id),
        normalizedStatus: event.status,
      });
      if (["PAID", "AUTHORIZED"].includes(event.status)) {
        await paymentOrchestrator.activateRideAfterPayment(
          String(ridePayment.rideId),
          event.status,
        );
      }
    }

    return {
      event: storedEvent,
      ridePayment,
      normalizedStatus: event.status,
    };
  },
};
