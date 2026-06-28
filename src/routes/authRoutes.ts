import { Router, Request, Response, NextFunction } from "express";
import AuthController from "../controllers/authController";
import authMiddleware from "../middlewares/authMiddleware";

const router = Router();

const asyncHandler = (
  fn: (req: Request, res: Response, next?: NextFunction) => any
) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await fn(req, res, next);
    } catch (err) {
      next(err);
    }
  };
};

// Login
router.post("/register", asyncHandler(AuthController.register));
router.post("/login", asyncHandler(AuthController.login));

// Onboarding status
router.get(
  "/onboarding-status",
  authMiddleware,
  asyncHandler(AuthController.onboardingStatus),
);
router.get(
  "/onboarding-status/:id",
  authMiddleware,
  asyncHandler(AuthController.onboardingStatus),
);

// Forgot password
router.post("/forgot-password", asyncHandler(AuthController.forgotPassword));
router.post(
  "/forgot-password/verify",
  asyncHandler(AuthController.verifyResetCode)
);
router.post("/reset-password", asyncHandler(AuthController.resetPassword));

// Email verification
router.post(
  "/email/send-code",
  authMiddleware,
  asyncHandler(AuthController.sendEmailCode)
);
router.post(
  "/email/verify",
  authMiddleware,
  asyncHandler(AuthController.verifyEmail)
);

// Phone verification
router.post(
  "/phone/send-code",
  authMiddleware,
  asyncHandler(AuthController.sendPhoneCode)
);
router.post(
  "/phone/verify",
  authMiddleware,
  asyncHandler(AuthController.verifyPhone)
);

// Reenvio genérico
router.post(
  "/resend-code",
  authMiddleware,
  asyncHandler(AuthController.resendCode)
);

export default router;
