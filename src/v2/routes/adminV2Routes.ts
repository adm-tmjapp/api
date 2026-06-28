import { Router } from "express";
import authMiddleware from "../../middlewares/authMiddleware";
import { UserController } from "../../controllers/userController";
import VehicleController from "../../controllers/vehicleController";
import DriverDocumentController from "../../controllers/driverDocumentController";
import Product from "../../models/Product";
import Tarifa from "../../models/Tarifa";
import Ride from "../../models/Ride";
import { asyncHandler } from "../common/asyncHandler";
import { SmsService } from "../../services/smsService";
import { adminBackofficeController } from "../controllers/adminBackofficeController";
import { adminBackofficeService } from "../services/adminBackofficeService";
import { adminPaymentSettingsController } from "../controllers/adminPaymentSettingsController";

const router = Router();

router.use(authMiddleware("admin"));

router.get("/users/:id", asyncHandler(UserController.getUserById));
router.put("/users/:id", asyncHandler(UserController.updateUser));
router.put("/users/:id/photo", asyncHandler(UserController.updateProfilePhoto));
router.put("/users/:id/block", asyncHandler(adminBackofficeController.blockUser));
router.put("/users/:id/unblock", asyncHandler(adminBackofficeController.unblockUser));
router.put(
  "/users/:id/reset-onboarding",
  asyncHandler(adminBackofficeController.resetDriverOnboarding),
);

router.get("/dashboard", asyncHandler(adminBackofficeController.getDashboard));
router.get("/users", asyncHandler(adminBackofficeController.listUsers));
router.get("/payments", asyncHandler(adminBackofficeController.listPayments));
router.get(
  "/payments/settings",
  asyncHandler(adminPaymentSettingsController.getCurrent),
);
router.put(
  "/payments/settings",
  asyncHandler(adminPaymentSettingsController.upsert),
);
router.get(
  "/payments/settings/list",
  asyncHandler(adminPaymentSettingsController.list),
);
router.get(
  "/payments/settings/audit-logs",
  asyncHandler(adminPaymentSettingsController.listAuditLogs),
);
router.delete(
  "/payments/settings/:id",
  asyncHandler(adminPaymentSettingsController.delete),
);
router.get("/search", asyncHandler(adminBackofficeController.search));
router.get("/audit-logs", asyncHandler(adminBackofficeController.getAuditLogs));

router.post(
  "/products",
  asyncHandler(async (req, res) => {
    const { name, icon, taxaId } = req.body;
    const product = await Product.create({ name, icon, taxaId });
    res.status(201).json(product);
  }),
);
router.get(
  "/products",
  asyncHandler(async (_req, res) => {
    const products = await Product.find();
    res.json(products);
  }),
);
router.get(
  "/products/:id",
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404).json({ error: "Produto não encontrado." });
      return;
    }
    res.json(product);
  }),
);
router.put(
  "/products/:id",
  asyncHandler(async (req, res) => {
    const { name, icon, taxaId } = req.body;
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { name, icon, taxaId },
      { new: true },
    );
    if (!product) {
      res.status(404).json({ error: "Produto não encontrado." });
      return;
    }
    res.json(product);
  }),
);
router.delete(
  "/products/:id",
  asyncHandler(async (req, res) => {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      res.status(404).json({ error: "Produto não encontrado." });
      return;
    }
    res.status(204).send();
  }),
);

router.post(
  "/tarifas",
  asyncHandler(async (req, res) => {
    const tarifa = await Tarifa.create(req.body);
    await adminBackofficeService.logTarifaAction({
      adminUserId: req.user?.id,
      action: "TARIFA_CREATE",
      tarifaId: String(tarifa._id),
      details: req.body,
    });
    res.status(201).json(tarifa);
  }),
);
router.get(
  "/tarifas",
  asyncHandler(async (_req, res) => {
    const tarifas = await Tarifa.find().sort({ vigenciaInicio: -1 });
    res.json(tarifas);
  }),
);
router.put(
  "/tarifas/:id",
  asyncHandler(async (req, res) => {
    const tarifa = await Tarifa.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!tarifa) {
      res.status(404).json({ error: "Tarifa não encontrada" });
      return;
    }
    await adminBackofficeService.logTarifaAction({
      adminUserId: req.user?.id,
      action: "TARIFA_UPDATE",
      tarifaId: String(tarifa._id),
      details: req.body,
    });
    res.json(tarifa);
  }),
);
router.delete(
  "/tarifas/:id",
  asyncHandler(async (req, res) => {
    const tarifa = await Tarifa.findByIdAndDelete(req.params.id);
    if (!tarifa) {
      res.status(404).json({ error: "Tarifa não encontrada" });
      return;
    }
    await adminBackofficeService.logTarifaAction({
      adminUserId: req.user?.id,
      action: "TARIFA_DELETE",
      tarifaId: String(tarifa._id),
    });
    res.json({ message: "Tarifa excluída com sucesso" });
  }),
);

router.get("/vehicles", asyncHandler(adminBackofficeController.listVehicles));
router.put(
  "/vehicles/batch/approve",
  asyncHandler(adminBackofficeController.batchApproveVehicles),
);
router.put(
  "/vehicles/batch/reject",
  asyncHandler(adminBackofficeController.batchRejectVehicles),
);
router.get("/vehicles/:id", asyncHandler(VehicleController.getVehicleById));
router.put("/vehicles/:id/approve", asyncHandler(adminBackofficeController.approveVehicle));
router.put("/vehicles/:id/reject", asyncHandler(adminBackofficeController.rejectVehicle));

router.get("/driver-documents", asyncHandler(adminBackofficeController.listDriverDocuments));
router.put(
  "/driver-documents/batch/approve",
  asyncHandler(adminBackofficeController.batchApproveDriverDocuments),
);
router.put(
  "/driver-documents/batch/reject",
  asyncHandler(adminBackofficeController.batchRejectDriverDocuments),
);
router.get("/driver-documents/:id", asyncHandler(DriverDocumentController.getDocumentById));
router.put(
  "/driver-documents/:id/approve",
  asyncHandler(adminBackofficeController.approveDriverDocument),
);
router.put(
  "/driver-documents/:id/reject",
  asyncHandler(adminBackofficeController.rejectDriverDocument),
);

router.get("/rides", asyncHandler(adminBackofficeController.listRides));
router.post("/rides/:id/cancel", asyncHandler(adminBackofficeController.cancelRide));
router.post("/rides/:id/reassign", asyncHandler(adminBackofficeController.reassignDriver));
router.get("/rides/:id", asyncHandler(adminBackofficeController.getRideDetails));

router.delete(
  "/rides",
  asyncHandler(async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      res
        .status(400)
        .json({ message: "Forneça um array de IDs para exclusão." });
      return;
    }
    const result = await Ride.deleteMany({ _id: { $in: ids } });
    res.json({
      message: "Corridas excluídas com sucesso",
      deletedCount: result.deletedCount,
    });
  }),
);

router.get(
  "/usage/sms/monthly",
  asyncHandler(async (req, res) => {
    const month =
      typeof req.query.month === "string" ? req.query.month : undefined;
    const usage = await SmsService.getMonthlyUsage(month);
    res.json(usage);
  }),
);

export default router;
