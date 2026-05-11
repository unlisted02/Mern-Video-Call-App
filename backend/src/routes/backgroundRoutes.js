import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import {
  getBackgroundCategories,
  getCloudinaryUploadSignature,
  searchUnsplashBackgrounds,
} from "../controllers/backgroundController.js";

const router = express.Router();

router.get("/categories", protectRoute, getBackgroundCategories);
router.get("/search", protectRoute, searchUnsplashBackgrounds);
router.post("/upload-signature", protectRoute, getCloudinaryUploadSignature);

export default router;
