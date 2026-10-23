import admin from "../../config/firebase";
import Ride from "../../models/Ride";
import { driverDeviceTokenService } from "./driverDeviceTokenService";
import { passengerDeviceTokenService } from "./passengerDeviceTokenService";

function invalidToken(error: any) { return ["messaging/invalid-argument", "messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(String(error?.code || error?.errorInfo?.code || "")); }

export async function notifyRideChatRecipient(input: { rideId: string; senderRole: "passenger" | "driver"; senderName: string; content: string }) {
  try {
    const ride: any = await Ride.findById(input.rideId).lean();
    if (!ride) return;
    const recipientId = input.senderRole === "passenger" ? String(ride.driver?.id || "") : String(ride.passengerId || ride.rider?.id || "");
    if (!recipientId) return;
    const tokens = input.senderRole === "passenger" ? await driverDeviceTokenService.listActiveTokens([recipientId]) : await passengerDeviceTokenService.listActiveTokens(recipientId);
    await Promise.all(tokens.map(async (candidate: any) => {
      try { await admin.messaging().send({ token: candidate.token, notification: { title: input.senderName || "Nova mensagem", body: input.content }, data: { type: "RIDE_CHAT_MESSAGE", rideId: input.rideId }, android: { priority: "high", notification: { channelId: "tmj_chat", sound: "default" } }, apns: { payload: { aps: { sound: "default" } } } }); }
      catch (error) { if (invalidToken(error)) { if (input.senderRole === "passenger") await driverDeviceTokenService.deactivateToken(candidate.token); else await passengerDeviceTokenService.deactivateToken(candidate.token); } }
    }));
  } catch (error) { console.error("[rideChatPushService] failed", error); }
}
