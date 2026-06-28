import { Router } from "express";
import { asyncHandler } from "../common/asyncHandler";
import { paymentV2Controller } from "../controllers/paymentV2Controller";

const router = Router();

router.post("/asaas", asyncHandler(paymentV2Controller.handleAsaasWebhook));

export default router;
