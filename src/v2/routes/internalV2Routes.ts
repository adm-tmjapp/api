import { Router } from "express";
import { rideExpirationService } from "../services/rideExpirationService";
import { asyncHandler } from "../common/asyncHandler";

const router = Router();

router.post("/rides/expire-payments", asyncHandler(async (req, res) => {
  const expected = String(process.env.RIDE_EXPIRATION_TOKEN || "").trim();
  const received = String(req.headers["x-internal-token"] || "").trim();

  if (!expected || received !== expected) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }

  const result = await rideExpirationService.expirePendingPayments(
    Number(req.body?.limit || 100),
  );
  res.status(200).json({ success: true, ...result });
}));

export default router;
