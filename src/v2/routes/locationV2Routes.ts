import { Router } from "express";
import { asyncHandler } from "../common/asyncHandler";
import { locationV2Controller } from "../controllers/locationV2Controller";

const router = Router();

router.get(
  "/search",
  asyncHandler(locationV2Controller.search),
);

export default router;
