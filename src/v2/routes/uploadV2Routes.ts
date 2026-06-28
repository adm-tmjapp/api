import { Router } from "express";
import multer from "multer";
import authMiddleware from "../../middlewares/authMiddleware";
import { asyncHandler } from "../common/asyncHandler";
import { uploadV2Controller } from "../controllers/uploadV2Controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authMiddleware());

router.post("/", upload.single("file"), asyncHandler(uploadV2Controller.upload));

export default router;

