import { Router } from "express";
import multer from "multer";
import authMiddleware from "../../middlewares/authMiddleware";
import { asyncHandler } from "../common/asyncHandler";
import { passengerAppController } from "../controllers/passengerAppController";
import { paymentV2Controller } from "../controllers/paymentV2Controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authMiddleware("passenger"));

router.post("/rides/request", asyncHandler(passengerAppController.createRide));
router.post("/rides", asyncHandler(passengerAppController.createRide));
router.put("/rides/:id/checkout", asyncHandler(passengerAppController.checkoutRide));
router.get("/rides", asyncHandler(passengerAppController.listRides));
router.get("/rides/:id", asyncHandler(passengerAppController.getRide));
router.get("/rides/:id/status", asyncHandler(passengerAppController.getRideStatus));
router.patch("/rides/:id/cancel", asyncHandler(passengerAppController.cancelRide));
router.post(
  "/rides/:id/realtime-token",
  asyncHandler(passengerAppController.issueRealtimeToken),
);
router.get("/rides/:id/eta", asyncHandler(passengerAppController.getRideEta));

router.post("/payments", asyncHandler(passengerAppController.createPayment));
router.get(
  "/payments/options",
  asyncHandler(paymentV2Controller.getPassengerPaymentOptions),
);
router.get(
  "/payments/methods",
  asyncHandler(passengerAppController.listPaymentMethods),
);
router.post(
  "/payments/methods/card-tokenize",
  asyncHandler(paymentV2Controller.tokenizePassengerCard),
);
router.post(
  "/payments/methods",
  asyncHandler(passengerAppController.createPaymentMethod),
);
router.delete(
  "/payments/methods/:id",
  asyncHandler(passengerAppController.deletePaymentMethod),
);
router.patch(
  "/payments/methods/:id/default",
  asyncHandler(passengerAppController.setDefaultPaymentMethod),
);
router.post(
  "/rides/:rideId/payments/pix",
  asyncHandler(paymentV2Controller.createPassengerPixPayment),
);
router.post(
  "/rides/:rideId/payments/card",
  asyncHandler(paymentV2Controller.createPassengerCardPayment),
);
router.post(
  "/rides/:rideId/payments/card/saved",
  asyncHandler(paymentV2Controller.createPassengerCardPayment),
);
router.get(
  "/rides/:rideId/payments/status",
  asyncHandler(paymentV2Controller.getPassengerRidePaymentStatus),
);
router.get(
  "/rides/:rideId/payments/receipt",
  asyncHandler(paymentV2Controller.getPassengerRidePaymentReceipt),
);

router.post(
  "/profile/photo",
  upload.single("file"),
  asyncHandler(passengerAppController.uploadProfilePhoto),
);
router.get("/profile/address", asyncHandler(passengerAppController.getAddress));
router.put("/profile/address", asyncHandler(passengerAppController.updateAddress));
router.get(
  "/profile/address-history",
  asyncHandler(passengerAppController.getAddressHistory),
);
router.post(
  "/profile/address-history",
  asyncHandler(passengerAppController.saveAddressHistory),
);

router.get(
  "/onboarding-status",
  asyncHandler(passengerAppController.getOnboardingStatus),
);

router.get(
  "/notifications",
  asyncHandler(passengerAppController.listNotifications),
);
router.patch(
  "/notifications/:id/read",
  asyncHandler(passengerAppController.markNotificationRead),
);
router.patch(
  "/notifications/read-all",
  asyncHandler(passengerAppController.markAllNotificationsRead),
);

export default router;
