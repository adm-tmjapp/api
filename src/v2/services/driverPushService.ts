import admin from "../../config/firebase";
import { driverDeviceTokenService } from "./driverDeviceTokenService";

type PushCandidate = {
  driverUserId: string;
  token: string;
};

export const driverPushService = {
  async sendNewRideRequest(
    candidates: PushCandidate[],
    payload: {
      rideId: string;
      pickupAddress: string | null;
      distanceKm: number;
      etaMin: number;
      price: number;
    },
  ) {
    const notifiedDriverUserIds: string[] = [];

    function shouldDeactivateToken(error: any) {
      const code = String(error?.code || error?.errorInfo?.code || "");
      return [
        "messaging/invalid-argument",
        "messaging/registration-token-not-registered",
        "messaging/invalid-registration-token",
      ].includes(code);
    }

    for (const candidate of candidates) {
      try {
        await admin.messaging().send({
          token: candidate.token,
          notification: {
            title: "Nova corrida disponível",
            body: payload.pickupAddress || "Você tem uma nova corrida próxima",
          },
          data: {
            type: "NEW_RIDE_REQUEST",
            rideId: payload.rideId,
            pickupAddress: payload.pickupAddress || "",
            distanceKm: String(payload.distanceKm),
            etaMin: String(payload.etaMin),
            price: String(payload.price),
          },
        });

        notifiedDriverUserIds.push(candidate.driverUserId);
      } catch (error: any) {
        console.error("[driverPushService.sendNewRideRequest] failed to send push", {
          driverUserId: candidate.driverUserId,
          tokenPreview: String(candidate.token).slice(0, 25),
          code: error?.code || error?.errorInfo?.code || null,
          message: error?.message || null,
        });

        if (shouldDeactivateToken(error)) {
          await driverDeviceTokenService.deactivateToken(candidate.token);
        }
      }
    }

    return {
      notifiedDriverUserIds,
    };
  },
};
