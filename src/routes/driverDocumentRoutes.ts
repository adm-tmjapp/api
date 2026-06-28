import express from "express";
import multer from "multer";
import DriverDocumentController from "../controllers/driverDocumentController";
import authMiddleware from "../middlewares/authMiddleware";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Public or protected: require auth depending on your app rules
router.post(
  "/upload",
  authMiddleware(),
  upload.single("file"),
  (req, res, next) => {
    DriverDocumentController.uploadFile(req as any, res as any).catch(next);
  }
);

router.post("/", authMiddleware(), (req, res, next) => {
  DriverDocumentController.createDocument(req as any, res as any).catch(next);
});
router.get("/", authMiddleware(), (req, res, next) => {
  DriverDocumentController.listDocuments(req as any, res as any).catch(next);
});
router.get("/:id", authMiddleware(), (req, res, next) => {
  DriverDocumentController.getDocumentById(req as any, res as any).catch(next);
});
router.put("/:id", authMiddleware(), (req, res, next) => {
  DriverDocumentController.updateDocument(req as any, res as any).catch(next);
});
router.delete("/:id", authMiddleware(), (req, res, next) => {
  DriverDocumentController.deleteDocument(req as any, res as any).catch(next);
});
router.put("/:id/approve", authMiddleware(), (req, res, next) => {
  DriverDocumentController.approveDocument(req as any, res as any).catch(next);
});
router.put("/:id/reject", authMiddleware(), (req, res, next) => {
  DriverDocumentController.rejectDocument(req as any, res as any).catch(next);
});
export default router;
