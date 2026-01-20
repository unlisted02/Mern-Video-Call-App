import express from "express";
import { Webhook } from "svix";
import { inngest } from "../lib/inngest.js";

const router = express.Router();

// Clerk webhook handler - transforms Clerk webhooks into Inngest events
// Note: This route must be registered BEFORE express.json() middleware
// to access raw body for svix verification
router.post("/clerk", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!WEBHOOK_SECRET) {
      console.error("❌ CLERK_WEBHOOK_SECRET is not set");
      return res.status(500).json({ error: "Webhook secret not configured" });
    }

    // Get the Svix headers for verification
    const svix_id = req.headers["svix-id"];
    const svix_timestamp = req.headers["svix-timestamp"];
    const svix_signature = req.headers["svix-signature"];

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return res.status(400).json({ error: "Missing svix headers" });
    }

    // Get the raw body (Buffer) for verification
    const payload = req.body;

    // Create a new Svix instance with your secret
    const wh = new Webhook(WEBHOOK_SECRET);

    let evt;

    try {
      // Verify the webhook
      evt = wh.verify(payload, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      });
    } catch (err) {
      console.error("❌ Error verifying webhook:", err);
      return res.status(400).json({ error: "Webhook verification failed" });
    }

    const { type, data } = evt;

    // Transform Clerk webhook into Inngest event
    if (type === "user.created") {
      // Send event to Inngest
      await inngest.send({
        name: "clerk/user.created",
        data: {
          id: data.id,
          email_addresses: data.email_addresses || [],
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          image_url: data.image_url || "",
        },
      });

      console.log("✅ Sent user.created event to Inngest:", data.id);
    } else if (type === "user.deleted") {
      // Send event to Inngest
      await inngest.send({
        name: "clerk/user.deleted",
        data: {
          id: data.id,
        },
      });

      console.log("✅ Sent user.deleted event to Inngest:", data.id);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("❌ Error processing Clerk webhook:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
