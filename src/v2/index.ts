import { Router } from "express";
import authV2Routes from "./routes/authV2Routes";
import adminV2Routes from "./routes/adminV2Routes";
import passengerV2Routes from "./routes/passengerV2Routes";
import driverV2Routes from "./routes/driverV2Routes";
import supportV2Routes from "./routes/supportV2Routes";
import uploadV2Routes from "./routes/uploadV2Routes";
import locationV2Routes from "./routes/locationV2Routes";
import webhooksV2Routes from "./routes/webhooksV2Routes";

const router = Router();

router.use("/auth", authV2Routes);
router.use("/admin", adminV2Routes);
router.use("/passenger", passengerV2Routes);
router.use("/driver", driverV2Routes);
router.use("/support", supportV2Routes);
router.use("/uploads", uploadV2Routes);
router.use("/locations", locationV2Routes);
router.use("/webhooks", webhooksV2Routes);

export default router;
