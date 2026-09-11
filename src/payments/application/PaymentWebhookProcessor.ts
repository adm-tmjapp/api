import RidePayment from "../../models/RidePayment";
import RidePaymentEvent from "../../models/RidePaymentEvent";
import { createPaymentProvider } from "../providers/PaymentProviderFactory";

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

    const storedEvent = await RidePaymentEvent.create({
      ridePaymentId: ridePayment?._id || null,
      provider: provider.name,
      providerEvent: event.providerEvent,
      providerPaymentId: event.providerPaymentId || null,
      providerEventId: event.providerEventId || null,
      payload: event.raw,
      processed: true,
      processedAt: new Date(),
    });

    if (ridePayment) {
      ridePayment.status = event.status;
      if (event.paidAt) {
        ridePayment.paidAt = new Date(event.paidAt);
      }
      ridePayment.providerPayload = event.raw;
      await ridePayment.save();
    }

    return {
      event: storedEvent,
      ridePayment,
      normalizedStatus: event.status,
    };
  },
};
