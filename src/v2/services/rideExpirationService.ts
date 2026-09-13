import Ride from "../../models/Ride";
import RideDispatchAttempt from "../../models/RideDispatchAttempt";
import { paymentOrchestrator } from "../../payments/application/PaymentOrchestrator";

const EXPIRABLE_PAYMENT_STATUSES = ["PENDING", "WAITING_PIX_PAYMENT"];

export const rideExpirationService = {
  async expirePendingPayments(limit = 100) {
    const rides = await Ride.find({
      status: "pending",
      paymentStatus: { $in: EXPIRABLE_PAYMENT_STATUSES },
      paymentExpiresAt: { $lte: new Date() },
    })
      .sort({ paymentExpiresAt: 1 })
      .limit(Math.min(Math.max(limit, 1), 500))
      .lean();

    let expired = 0;
    let skipped = 0;
    const errors: Array<{ rideId: string; message: string }> = [];

    for (const ride of rides) {
      const rideId = String(ride._id);
      try {
        await paymentOrchestrator.cancelRidePayment({
          rideId,
          passengerId: String(ride.passengerId || ""),
        });

        const canceled = await Ride.findOneAndUpdate(
          {
            _id: ride._id,
            status: "pending",
            paymentStatus: { $in: EXPIRABLE_PAYMENT_STATUSES },
            paymentExpiresAt: { $lte: new Date() },
          },
          {
            $set: {
              status: "canceled",
              paymentStatus: "CANCELED",
              canceledAt: new Date(),
              cancellationReason: "PAYMENT_TIMEOUT",
              notes: "Cancelado automaticamente por expiração do pagamento.",
            },
            $unset: { paymentExpiresAt: 1 },
          },
          { new: true },
        );

        if (!canceled) {
          skipped += 1;
          continue;
        }

        await RideDispatchAttempt.updateMany(
          { rideId: ride._id, status: "OPEN" },
          { $set: { status: "CANCELED", completedAt: new Date() } },
        );
        expired += 1;
      } catch (error) {
        errors.push({
          rideId,
          message: (error as Error)?.message || String(error),
        });
      }
    }

    return { scanned: rides.length, expired, skipped, errors };
  },
};
