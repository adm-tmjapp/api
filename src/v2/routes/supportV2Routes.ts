import { Router } from "express";
import authMiddleware from "../../middlewares/authMiddleware";
import { asyncHandler } from "../common/asyncHandler";
import { driverRideSupportController } from "../controllers/driverRideSupportController";

const router = Router();

router.use(authMiddleware());

router.get("/contact", asyncHandler(driverRideSupportController.getSupportContact));

export default router;

