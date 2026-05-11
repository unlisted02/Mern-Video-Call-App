import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import {
  getBackgroundPreference,
  upsertBackgroundPreference,
} from "../controllers/userPreferencesController.js";

const router = express.Router();

router.get("/background-preference", protectRoute, getBackgroundPreference);
router.post("/background-preference", protectRoute, upsertBackgroundPreference);

export default router;
