import { ENV } from "../lib/env.js";
import crypto from "crypto";

const DEFAULT_CATEGORIES = ["Nature", "Office", "Minimal", "City", "Abstract"];

const UNSPLASH_ENDPOINT = "https://api.unsplash.com/search/photos";

export async function getBackgroundCategories(_, res) {
  res.status(200).json({ categories: DEFAULT_CATEGORIES });
}

export async function searchUnsplashBackgrounds(req, res) {
  try {
    if (!ENV.UNSPLASH_ACCESS_KEY) {
      return res.status(500).json({ message: "Unsplash is not configured on the server" });
    }

    const query = req.query.q?.toString().trim();
    const page = Number.parseInt(req.query.page?.toString() || "1", 10);
    const perPage = Number.parseInt(req.query.perPage?.toString() || "18", 10);

    if (!query) {
      return res.status(400).json({ message: "Query parameter q is required" });
    }

    const safePerPage = Number.isFinite(perPage) ? Math.min(Math.max(perPage, 1), 30) : 18;
    const safePage = Number.isFinite(page) ? Math.max(page, 1) : 1;

    const params = new URLSearchParams({
      query,
      page: String(safePage),
      per_page: String(safePerPage),
      orientation: "landscape",
      content_filter: "high",
    });

    const response = await fetch(`${UNSPLASH_ENDPOINT}?${params.toString()}`, {
      headers: {
        Authorization: `Client-ID ${ENV.UNSPLASH_ACCESS_KEY}`,
        "Accept-Version": "v1",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Unsplash search failed:", errorText);
      return res.status(response.status).json({ message: "Failed to fetch backgrounds from Unsplash" });
    }

    const payload = await response.json();
    const images = (payload.results || []).map((item) => ({
      unsplashId: item.id,
      thumbUrl: item.urls?.small,
      fullUrl: item.urls?.regular,
      rawUrl: item.urls?.raw,
      altDescription: item.alt_description || "Unsplash background",
      photographer: item.user?.name || "Unknown photographer",
      photographerUrl: item.user?.links?.html,
      unsplashUrl: item.links?.html,
    }));

    return res.status(200).json({
      query,
      page: safePage,
      total: payload.total || 0,
      totalPages: payload.total_pages || 0,
      images,
    });
  } catch (error) {
    console.error("Error in searchUnsplashBackgrounds:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getCloudinaryUploadSignature(req, res) {
  try {
    if (!ENV.CLOUDINARY_CLOUD_NAME || !ENV.CLOUDINARY_API_KEY || !ENV.CLOUDINARY_API_SECRET) {
      return res.status(500).json({ message: "Cloudinary is not configured on the server" });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = ENV.CLOUDINARY_UPLOAD_FOLDER;
    const publicIdPrefix = req.user?._id?.toString() || "user";
    const publicId = `${publicIdPrefix}_${Date.now()}`;

    const paramsToSign = {
      timestamp,
      folder,
      public_id: publicId,
    };

    const signatureBase = Object.entries(paramsToSign)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
    const signature = crypto
      .createHash("sha1")
      .update(`${signatureBase}${ENV.CLOUDINARY_API_SECRET}`)
      .digest("hex");

    return res.status(200).json({
      timestamp,
      signature,
      folder,
      publicId,
      cloudName: ENV.CLOUDINARY_CLOUD_NAME,
      apiKey: ENV.CLOUDINARY_API_KEY,
    });
  } catch (error) {
    console.error("Error in getCloudinaryUploadSignature:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
