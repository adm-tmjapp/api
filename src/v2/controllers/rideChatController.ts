import { Request, Response } from "express";
import {
  rideChatService,
  RideChatServiceError,
} from "../services/rideChatService";

function handleError(res: Response, error: unknown) {
  if (error instanceof RideChatServiceError) {
    res.status(error.status).json({
      success: false,
      message: error.message,
      code: error.code,
    });
    return;
  }
  res.status(500).json({
    success: false,
    message: "Não foi possível processar o chat.",
    code: "RIDE_CHAT_ERROR",
  });
}

export function createRideChatController(role: "passenger" | "driver") {
  return {
    list: async (req: Request, res: Response) => {
      try {
        const messages = await rideChatService.listMessages(
          String(req.params.rideId),
          req.user?.id as string,
          role,
          Number(req.query.limit),
        );
        res.status(200).json({ success: true, messages });
      } catch (error) {
        handleError(res, error);
      }
    },
    send: async (req: Request, res: Response) => {
      try {
        const message = await rideChatService.sendMessage(
          String(req.params.rideId),
          req.user?.id as string,
          role,
          req.body?.content,
        );
        res.status(201).json({ success: true, message });
      } catch (error) {
        handleError(res, error);
      }
    },
    markRead: async (req: Request, res: Response) => {
      try {
        const result = await rideChatService.markAsRead(
          String(req.params.rideId),
          req.user?.id as string,
          role,
        );
        res.status(200).json(result);
      } catch (error) {
        handleError(res, error);
      }
    },
  };
}
