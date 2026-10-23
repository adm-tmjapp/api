import Ride from "../../models/Ride";
import RideMessage, { RideMessageSenderRole } from "../../models/RideMessage";
import { notifyRideChatRecipient } from "./rideChatPushService";

export class RideChatServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

function participantField(role: RideMessageSenderRole): string {
  return role === "driver" ? "driver.id" : "passengerId";
}

async function getRideForParticipant(
  rideId: string,
  userId: string,
  role: RideMessageSenderRole,
) {
  if (!rideId || !userId) {
    throw new RideChatServiceError(400, "Corrida inválida.", "INVALID_RIDE");
  }

  const ride = await Ride.findOne({
    _id: rideId,
    [participantField(role)]: userId,
  }).lean();

  if (!ride) {
    throw new RideChatServiceError(
      404,
      "Corrida não encontrada ou sem permissão para acessar o chat.",
      "RIDE_CHAT_FORBIDDEN",
    );
  }

  if (ride.status !== "accepted" && ride.status !== "ongoing") {
    throw new RideChatServiceError(
      409,
      ride.status === "pending"
        ? "O chat será liberado quando a corrida for aceita."
        : "Por segurança, o chat foi encerrado após o término da corrida.",
      ride.status === "pending" ? "CHAT_NOT_AVAILABLE" : "CHAT_CLOSED",
    );
  }

  return ride;
}

function serializeMessage(message: any, currentUserId: string) {
  return {
    id: String(message._id),
    rideId: String(message.rideId),
    senderId: String(message.senderId),
    senderRole: message.senderRole,
    content: message.content,
    isMine: String(message.senderId) === currentUserId,
    readAt: message.readAt ?? null,
    createdAt: message.createdAt,
  };
}

export const rideChatService = {
  async listMessages(
    rideId: string,
    userId: string,
    role: RideMessageSenderRole,
    limit = 50,
  ) {
    await getRideForParticipant(rideId, userId, role);
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const messages = await RideMessage.find({ rideId })
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .lean();

    return messages.reverse().map((message) => serializeMessage(message, userId));
  },

  async unreadCount(rideId: string, userId: string, role: RideMessageSenderRole) {
    await getRideForParticipant(rideId, userId, role);
    return RideMessage.countDocuments({ rideId, senderId: { $ne: userId }, readAt: null });
  },

  async sendMessage(
    rideId: string,
    userId: string,
    role: RideMessageSenderRole,
    content: unknown,
  ) {
    await getRideForParticipant(rideId, userId, role);
    const normalizedContent = typeof content === "string" ? content.trim() : "";

    if (!normalizedContent) {
      throw new RideChatServiceError(
        400,
        "Digite uma mensagem antes de enviar.",
        "EMPTY_MESSAGE",
      );
    }
    if (normalizedContent.length > 500) {
      throw new RideChatServiceError(
        400,
        "A mensagem deve ter no máximo 500 caracteres.",
        "MESSAGE_TOO_LONG",
      );
    }
    if (/https?:\/\/|www\.|\b\d{8,13}\b/i.test(normalizedContent)) {
      throw new RideChatServiceError(400, "Por segurança, não envie links ou números de telefone pelo chat.", "MESSAGE_BLOCKED");
    }
    const recentMessages = await RideMessage.countDocuments({ senderId: userId, createdAt: { $gte: new Date(Date.now() - 60_000) } });
    if (recentMessages >= 30) throw new RideChatServiceError(429, "Aguarde um pouco antes de enviar novas mensagens.", "MESSAGE_RATE_LIMIT");

    const message = await RideMessage.create({
      rideId,
      senderId: userId,
      senderRole: role,
      content: normalizedContent,
    });
    void notifyRideChatRecipient({ rideId, senderRole: role, senderName: role === "driver" ? "Seu motorista" : "Seu passageiro", content: normalizedContent });

    return serializeMessage(message.toObject(), userId);
  },

  async markAsRead(rideId: string, userId: string, role: RideMessageSenderRole) {
    await getRideForParticipant(rideId, userId, role);
    await RideMessage.updateMany(
      { rideId, senderId: { $ne: userId }, readAt: null },
      { $set: { readAt: new Date() } },
    );
    return { success: true };
  },
};
