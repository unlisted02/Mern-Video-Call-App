const ALLOWED_TYPES = new Set(["none", "blur", "unsplash", "upload"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function getBackgroundPreference(req, res) {
  try {
    const preference = req.user.backgroundPreference || { type: "none", value: {} };
    return res.status(200).json({ preference });
  } catch (error) {
    console.error("Error in getBackgroundPreference:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function upsertBackgroundPreference(req, res) {
  try {
    const { type, value = {} } = req.body || {};

    if (!ALLOWED_TYPES.has(type)) {
      return res.status(400).json({ message: "Invalid background preference type" });
    }

    if (!isObject(value)) {
      return res.status(400).json({ message: "Preference value must be an object" });
    }

    req.user.backgroundPreference = { type, value };
    await req.user.save();

    return res.status(200).json({
      message: "Background preference saved",
      preference: req.user.backgroundPreference,
    });
  } catch (error) {
    console.error("Error in upsertBackgroundPreference:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
