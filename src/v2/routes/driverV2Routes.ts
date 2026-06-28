import { Router } from "express";
import multer from "multer";
import authMiddleware from "../../middlewares/authMiddleware";
import Driver from "../../models/Driver";
import Vehicle from "../../models/Vehicle";
import User from "../../models/User";
import VehicleController from "../../controllers/vehicleController";
import DriverDocumentController from "../../controllers/driverDocumentController";
import { UserController } from "../../controllers/userController";
import { asyncHandler } from "../common/asyncHandler";
import { driverDashboardController } from "../controllers/driverDashboardController";
import { driverRealtimeController } from "../controllers/driverRealtimeController";
import { driverRideHistoryController } from "../controllers/driverRideHistoryController";
import { driverRideSupportController } from "../controllers/driverRideSupportController";
import { driverWalletController } from "../controllers/driverWalletController";
import { driverProfileController } from "../controllers/driverProfileController";
import { driverVehicleProfileController } from "../controllers/driverVehicleProfileController";
import { driverLocationController } from "../controllers/driverLocationController";
import { driverDeviceTokenController } from "../controllers/driverDeviceTokenController";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authMiddleware("driver"));

router.post(
  "/profile/register",
  asyncHandler(async (req, res) => {
    const { licenseNumber, vehicle } = req.body;
    const userId = req.user?.id;

    const newDriver = await Driver.create({ userId, licenseNumber, vehicle });
    res.status(201).json({ message: "Motorista registrado", newDriver });
  }),
);

router.get(
  "/profile",
  asyncHandler(driverProfileController.getProfile),
);

router.put(
  "/profile",
  asyncHandler(driverProfileController.updateProfile),
);

router.get(
  "/profile/vehicle",
  asyncHandler(driverProfileController.getVehicle),
);

router.get(
  "/profile/vehicles",
  asyncHandler(driverVehicleProfileController.listVehicles),
);

router.post(
  "/profile/vehicles",
  asyncHandler(driverVehicleProfileController.createVehicle),
);

router.patch(
  "/profile/vehicles/:vehicleId/activate",
  asyncHandler(driverVehicleProfileController.activateVehicle),
);

router.get(
  "/profile/vehicles/:vehicleId/documents",
  asyncHandler(driverVehicleProfileController.getDocuments),
);

router.post(
  "/profile/vehicles/:vehicleId/documents",
  upload.single("file"),
  asyncHandler(driverVehicleProfileController.uploadDocuments),
);

router.post(
  "/profile/vehicles/:vehicleId/photo",
  upload.single("file"),
  asyncHandler(driverVehicleProfileController.uploadPhoto),
);

router.get(
  "/profile/documents",
  asyncHandler(driverProfileController.getDocuments),
);

router.get(
  "/profile/address",
  asyncHandler(driverProfileController.getAddress),
);

router.put(
  "/profile/address",
  asyncHandler(driverProfileController.updateAddress),
);

router.get(
  "/profile/address-history",
  asyncHandler(driverProfileController.getAddressHistory),
);

router.post(
  "/profile/address-history",
  asyncHandler(driverProfileController.saveAddressHistory),
);

router.get(
  "/profile/security",
  asyncHandler(driverProfileController.getSecurity),
);

router.get(
  "/profile/:userId",
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const userObj = await User.findOne({ userId });
    const vehicleObj = await Vehicle.findOne({ userId }, "_id status");

    if (!vehicleObj) {
      res.status(404).json({ message: "Veículo não encontrado" });
      return;
    }

    res.json({ user: userObj, vehicle: vehicleObj });
  }),
);

router.put(
  "/profile/photo",
  upload.single("file"),
  asyncHandler(UserController.uploadOwnProfilePhoto),
);

router.post(
  "/onboarding/documents",
  upload.fields([
    { name: "cnhFront", maxCount: 1 },
    { name: "cnhBack", maxCount: 1 },
    { name: "selfie", maxCount: 1 },
  ]),
  asyncHandler(DriverDocumentController.uploadDriverOnboardingDocuments),
);

router.post(
  "/onboarding/vehicle",
  asyncHandler(VehicleController.saveOnboardingVehicle),
);

router.get(
  "/dashboard",
  asyncHandler(driverDashboardController.getDashboard),
);

router.patch(
  "/availability",
  asyncHandler(driverDashboardController.updateAvailability),
);

router.post(
  "/location",
  asyncHandler(driverLocationController.update),
);

router.post(
  "/device-token",
  asyncHandler(driverDeviceTokenController.register),
);

router.get(
  "/rides/pending",
  asyncHandler(driverDashboardController.listPendingRides),
);

router.post(
  "/rides/:rideId/accept",
  asyncHandler(driverDashboardController.acceptRide),
);

router.post(
  "/rides/:rideId/arrive",
  asyncHandler(driverDashboardController.arriveRide),
);

router.post(
  "/rides/:rideId/start",
  asyncHandler(driverDashboardController.startRide),
);

router.post(
  "/rides/:rideId/complete",
  asyncHandler(driverDashboardController.completeRide),
);

router.get(
  "/rides/current",
  asyncHandler(driverDashboardController.getCurrentRide),
);

router.post(
  "/rides/:rideId/realtime-token",
  asyncHandler(driverRealtimeController.issueRealtimeToken),
);

router.post(
  "/rides/:rideId/location/snapshot",
  asyncHandler(driverRealtimeController.saveLocationSnapshot),
);

router.get(
  "/rides/:rideId/eta",
  asyncHandler(driverRealtimeController.getRideEta),
);

router.get(
  "/rides/history/summary",
  asyncHandler(driverRideHistoryController.getSummary),
);

router.get(
  "/rides/history",
  asyncHandler(driverRideHistoryController.getHistory),
);

router.get(
  "/rides/:rideId/history-detail",
  asyncHandler(driverRideHistoryController.getHistoryDetail),
);

router.get(
  "/rides/:rideId/support/options",
  asyncHandler(driverRideSupportController.getSupportOptions),
);

router.post(
  "/rides/:rideId/support/tickets",
  asyncHandler(driverRideSupportController.createSupportTicket),
);

router.post(
  "/rides/:rideId/support/payment-issue",
  asyncHandler(driverRideSupportController.createPaymentIssue),
);

router.post(
  "/rides/:rideId/support/forgotten-object",
  asyncHandler(driverRideSupportController.createForgottenObject),
);

router.post(
  "/rides/:rideId/support/passenger-absent",
  asyncHandler(driverRideSupportController.createPassengerAbsent),
);

router.get(
  "/wallet/summary",
  asyncHandler(driverWalletController.getSummary),
);

router.get(
  "/wallet/activities",
  asyncHandler(driverWalletController.getActivities),
);

router.post(
  "/wallet/transfers/pix",
  asyncHandler(driverWalletController.createPixTransfer),
);

router.get(
  "/wallet/transfers/:transferId",
  asyncHandler(driverWalletController.getTransfer),
);

router.get(
  "/wallet/transfers/:transferId/receipt",
  asyncHandler(driverWalletController.getTransferReceipt),
);

router.post("/vehicles", asyncHandler(VehicleController.createVehicle));
router.get("/vehicles", asyncHandler(VehicleController.listVehicles));
router.get("/vehicles/:id", asyncHandler(VehicleController.getVehicleById));
router.put("/vehicles/:id", asyncHandler(VehicleController.updateVehicle));
router.delete("/vehicles/:id", asyncHandler(VehicleController.deleteVehicle));
router.post("/vehicles/:id/documents", asyncHandler(VehicleController.addDocument));
router.delete(
  "/vehicles/:id/documents",
  asyncHandler(VehicleController.removeDocument),
);
router.put("/vehicles/:id/photo", asyncHandler(VehicleController.updatePhoto));

router.post("/driver-documents", asyncHandler(DriverDocumentController.createDocument));
router.get("/driver-documents", asyncHandler(DriverDocumentController.listDocuments));
router.get("/driver-documents/:id", asyncHandler(DriverDocumentController.getDocumentById));
router.put("/driver-documents/:id", asyncHandler(DriverDocumentController.updateDocument));
router.delete("/driver-documents/:id", asyncHandler(DriverDocumentController.deleteDocument));

export default router;
