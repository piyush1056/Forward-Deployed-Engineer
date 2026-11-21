import { Router } from "express";
import {
    startReleaseNotes,
    getReleaseTaskStatus,
    approveReleaseTask,
} from "../controllers/releaseController.js";

const router = Router();

router.post("/start", startReleaseNotes);
router.get("/:taskId", getReleaseTaskStatus);
router.post("/:taskId/approve", approveReleaseTask);

export default router;