import { requireAuth, clerkClient } from "@clerk/express";
import User from "../models/User.js";

export const protectRoute = [
  requireAuth(),
  async (req, res, next) => {
    try {
      const clerkId = req.auth().userId;
      if (!clerkId) return res.status(401).json({ message: "Unauthorized - invalid token" });

      let user = await User.findOne({ clerkId });

      if (!user) {
        const allowAutoCreate =
          process.env.NODE_ENV === "development" || process.env.AUTO_CREATE_USER_ON_AUTH === "true";

        if (!allowAutoCreate) {
          return res.status(404).json({ message: "User not found" });
        }

        try {
          const clerkUser = await clerkClient.users.getUser(clerkId);
          const email = clerkUser?.emailAddresses?.[0]?.emailAddress || "";
          const name =
            [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") ||
            clerkUser?.username ||
            email ||
            "User";
          const profileImage = clerkUser?.imageUrl || "";

          // Idempotent upsert is safer in case of races:
          user = await User.findOneAndUpdate(
            { clerkId },
            { $setOnInsert: { clerkId, email, name, profileImage } },
            { upsert: true, new: true }
          );
        } catch {
          return res.status(404).json({ message: "User not found" });
        }
      }

      req.user = user;
      next();
    } catch (error) {
      console.error("Error in protectRoute middleware", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
];