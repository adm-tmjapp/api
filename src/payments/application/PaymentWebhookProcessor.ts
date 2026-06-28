import RidePayment from "../../models/RidePayment";
import RidePaymentEvent from "../../models/RidePaymentEvent";
import { createPaymentProvider } from "../providers/PaymentProviderFactory";

export const paymentWebhookProcessor = {
  async process(providerName: string, payload: Record<string, unknown>) {
    const provider = createPaymentProvider(providerName);
    const event = provider.parseWebhook(payload);

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
