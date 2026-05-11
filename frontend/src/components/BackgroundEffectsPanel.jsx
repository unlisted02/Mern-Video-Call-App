import { useMemo, useState } from "react";
import { ImageIcon, Loader2Icon, SearchIcon, SparklesIcon, UploadIcon, WindIcon } from "lucide-react";
import toast from "react-hot-toast";
import { backgroundsApi } from "../api/backgrounds";

const DEFAULT_CATEGORIES = ["Nature", "Office", "Minimal", "City", "Abstract"];
const DEFAULT_PREVIEW = { type: "none", value: {} };
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function getBlurStrength(strength) {
  if (strength === "high") return "High";
  if (strength === "medium") return "Medium";
  return "Low";
}

function buildUnsplashPreference(image) {
  return {
    type: "unsplash",
    value: {
      unsplashId: image.unsplashId,
      imageUrl: image.fullUrl,
      thumbUrl: image.thumbUrl,
      photographer: image.photographer,
      photographerUrl: image.photographerUrl,
      unsplashUrl: image.unsplashUrl,
    },
  };
}

async function uploadToCloudinary(file) {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Only JPG, PNG, and WEBP are allowed");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Maximum upload size is 5MB");
  }

  const signature = await backgroundsApi.getUploadSignature();

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", signature.apiKey);
  form.append("timestamp", String(signature.timestamp));
  form.append("signature", signature.signature);
  form.append("folder", signature.folder);
  form.append("public_id", signature.publicId);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`,
    {
      method: "POST",
      body: form,
    }
  );

  if (!response.ok) {
    throw new Error("Upload failed. Please try again.");
  }

  return response.json();
}

function BackgroundEffectsPanel({
  selectedPreference,
  onSelectPreference,
  onSaveDefault,
  isSavingDefault = false,
}) {
  const [search, setSearch] = useState("");
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [results, setResults] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const currentPreference = selectedPreference || DEFAULT_PREVIEW;

  const selectedDescription = useMemo(() => {
    if (currentPreference.type === "blur") {
      return `Blur (${getBlurStrength(currentPreference.value?.strength)})`;
    }
    if (currentPreference.type === "unsplash") {
      return "Unsplash image";
    }
    if (currentPreference.type === "upload") {
      return "Uploaded image";
    }
    return "No effect";
  }, [currentPreference]);

  const loadCategories = async () => {
    if (categories.length > 0 && categories !== DEFAULT_CATEGORIES) return;
    try {
      setIsLoadingCategories(true);
      const data = await backgroundsApi.getCategories();
      setCategories(data.categories || DEFAULT_CATEGORIES);
    } catch {
      setCategories(DEFAULT_CATEGORIES);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const runSearch = async (query) => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }

    try {
      setIsLoadingSearch(true);
      const data = await backgroundsApi.search({ query: q });
      setResults(data.images || []);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to search Unsplash images");
    } finally {
      setIsLoadingSearch(false);
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const result = await uploadToCloudinary(file);
      onSelectPreference({
        type: "upload",
        value: {
          publicId: result.public_id,
          imageUrl: result.secure_url,
          width: result.width,
          height: result.height,
          format: result.format,
        },
      });
      toast.success("Background uploaded");
    } catch (error) {
      toast.error(error.message || "Failed to upload image");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="card bg-base-100 border border-base-300">
        <div className="card-body p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <SparklesIcon className="size-4 text-primary" />
              Background Effects
            </h3>
            <span className="badge badge-outline">{selectedDescription}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className={`btn btn-sm ${currentPreference.type === "none" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => onSelectPreference({ type: "none", value: {} })}
            >
              None
            </button>
            <button
              className={`btn btn-sm ${currentPreference.type === "blur" && currentPreference.value?.strength === "low" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => onSelectPreference({ type: "blur", value: { strength: "low" } })}
            >
              <WindIcon className="size-4" />
              Blur Low
            </button>
            <button
              className={`btn btn-sm ${currentPreference.type === "blur" && currentPreference.value?.strength === "medium" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => onSelectPreference({ type: "blur", value: { strength: "medium" } })}
            >
              Blur Medium
            </button>
            <button
              className={`btn btn-sm ${currentPreference.type === "blur" && currentPreference.value?.strength === "high" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => onSelectPreference({ type: "blur", value: { strength: "high" } })}
            >
              Blur High
            </button>
          </div>

          <div className="space-y-2">
            <label className="input input-bordered flex items-center gap-2">
              <SearchIcon className="size-4 opacity-60" />
              <input
                className="grow"
                type="text"
                placeholder="Search Unsplash backgrounds..."
                value={search}
                onFocus={loadCategories}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    runSearch(search);
                  }
                }}
              />
            </label>

            <div className="flex flex-wrap gap-2">
              {isLoadingCategories ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                categories.map((category) => (
                  <button
                    key={category}
                    className="btn btn-xs btn-outline"
                    onClick={() => {
                      setSearch(category);
                      runSearch(category);
                    }}
                  >
                    {category}
                  </button>
                ))
              )}
            </div>
          </div>

          {isLoadingSearch ? (
            <div className="py-8 text-center">
              <Loader2Icon className="size-5 animate-spin mx-auto text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {results.map((image) => (
                <button
                  key={image.unsplashId}
                  className="group text-left"
                  onClick={() => onSelectPreference(buildUnsplashPreference(image))}
                >
                  <img
                    src={image.thumbUrl}
                    alt={image.altDescription || "Unsplash image"}
                    className="rounded-lg w-full h-20 object-cover border border-base-300 group-hover:border-primary transition-colors"
                  />
                  <p className="text-[11px] mt-1 text-base-content/70 truncate">
                    {image.photographer}
                  </p>
                </button>
              ))}
            </div>
          )}

          {currentPreference.type === "unsplash" && currentPreference.value?.photographer && (
            <p className="text-xs text-base-content/70">
              Photo by{" "}
              <a
                href={currentPreference.value.photographerUrl}
                target="_blank"
                rel="noreferrer"
                className="link link-primary"
              >
                {currentPreference.value.photographer}
              </a>{" "}
              on Unsplash
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              className={`btn btn-sm btn-ghost ${currentPreference.type === "none" ? "btn-disabled" : ""}`}
              onClick={() => onSelectPreference({ type: "none", value: {} })}
              disabled={currentPreference.type === "none"}
            >
              Remove background
            </button>
            <label className={`btn btn-sm btn-outline ${isUploading ? "btn-disabled" : ""}`}>
              <UploadIcon className="size-4" />
              {isUploading ? "Uploading..." : "Upload image"}
              <input
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleUpload}
                disabled={isUploading}
              />
            </label>
            <button
              className={`btn btn-sm btn-primary ${isSavingDefault ? "btn-disabled" : ""}`}
              onClick={() => onSaveDefault(currentPreference)}
            >
              <ImageIcon className="size-4" />
              Save as default
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BackgroundEffectsPanel;
