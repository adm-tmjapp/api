import { Router } from "express";
import { asyncHandler } from "../common/asyncHandler";
import { paymentV2Controller } from "../controllers/paymentV2Controller";
import crypto from "node:crypto";

const router = Router();

router.post("/asaas", (req, res, next) => {
  const expected = String(process.env.ASAAS_WEBHOOK_TOKEN || "").trim();
  const received = String(req.headers["asaas-access-token"] || "").trim();
  if (!expected || !received || expected.length !== received.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))) {
    res.status(401).json({ statusCode: 401, error: "INVALID_WEBHOOK_TOKEN", message: "Webhook não autorizado." });
    return;
  }
  next();
}, asyncHandler(paymentV2Controller.handleAsaasWebhook));

export default router;
