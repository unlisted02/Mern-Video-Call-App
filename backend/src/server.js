import express from "express";
import path from "path";
import cors from "cors";
import { serve } from "inngest/express";
import { clerkMiddleware } from "@clerk/express";

import { ENV } from "./lib/env.js";
import { connectDB } from "./lib/db.js";
import { inngest, functions } from "./lib/inngest.js";

import chatRoutes from "./routes/chatRoutes.js";
import sessionRoutes from "./routes/sessionRoute.js";
import { fileURLToPath } from "url";


const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// middleware
app.use(express.json());
// credentials:true meaning?? => server allows a browser to include cookies on request
app.use(cors({ origin: ENV.CLIENT_URL, credentials: true }));
app.use(clerkMiddleware()); // this adds auth field to request object: req.auth()

app.use("/api/inngest", serve({ client: inngest, functions }));
app.use("/api/chat", chatRoutes);
app.use("/api/sessions", sessionRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({ msg: "api is up and running" });
});

// make our app ready for deployment
if (ENV.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "../../frontend/dist");
  
  // Serve static files from the React build
  app.use(express.static(distPath, { index: false }));

  // Catch-all handler: serve index.html for client-side routing
  // Express 5 doesn't support wildcard routes like '/*' or '*'
  // This middleware catches all requests that aren't API routes or static files
  app.use((req, res, next) => {
    // API routes and health check are handled above, so skip them
    if (req.path.startsWith("/api") || req.path === "/health") {
      return next();
    }
    // Serve index.html for all other routes (React Router handles routing)
    res.sendFile(path.join(distPath, "index.html"));
  });
}

const startServer = async () => {
  try { 
    await connectDB();
    app.listen(ENV.PORT, "0.0.0.0", () => {
      console.log(`🚀 Server is running on port: ${ENV.PORT}`);
      console.log(`📦 Environment: ${ENV.NODE_ENV || "development"}`);
    });
  } catch (error) {
    console.error("💥 Error starting the server:", error);
    process.exit(1); // Exit with error code so Render knows deployment failed
  }
};

startServer();