import { Router } from "express";
import AuthController from "../../controllers/authController";
import authMiddleware from "../../middlewares/authMiddleware";
import { asyncHandler } from "../common/asyncHandler";

const router = Router();

router.post("/register", asyncHandler(AuthController.register.bind(AuthController)));
router.post("/login", asyncHandler(AuthController.login.bind(AuthController)));
router.post(
  "/logout",
  authMiddleware(),
  asyncHandler(AuthController.logout.bind(AuthController)),
);

router.get(
  "/onboarding-status",
  authMiddleware(),
  asyncHandler(AuthController.onboardingStatus.bind(AuthController)),
);

router.get(
  "/onboarding-status/:id",
  authMiddleware(),
  asyncHandler(AuthController.onboardingStatus.bind(AuthController)),
);

router.post(
  "/forgot-password",
  asyncHandler(AuthController.forgotPassword.bind(AuthController)),
);
router.post(
  "/forgot-password/verify",
  asyncHandler(AuthController.verifyResetCode.bind(AuthController)),
);
router.post(
  "/reset-password",
  asyncHandler(AuthController.resetPassword.bind(AuthController)),
);

router.post(
  "/email/send-code",
  authMiddleware(),
  asyncHandler(AuthController.sendEmailCode.bind(AuthController)),
);
router.post(
  "/email/verify",
  authMiddleware(),
  asyncHandler(AuthController.verifyEmail.bind(AuthController)),
);
router.post(
  "/email/validate",
  authMiddleware(),
  asyncHandler(AuthController.verifyEmail.bind(AuthController)),
);

router.post(
  "/phone/send-code",
  authMiddleware(),
  asyncHandler(AuthController.sendPhoneCode.bind(AuthController)),
);
router.post(
  "/phone/verify",
  authMiddleware(),
  asyncHandler(AuthController.verifyPhone.bind(AuthController)),
);
router.post(
  "/phone/validate",
  authMiddleware(),
  asyncHandler(AuthController.verifyPhone.bind(AuthController)),
);

router.post(
  "/resend-code",
  authMiddleware(),
  asyncHandler(AuthController.resendCode.bind(AuthController)),
);

export default router;
