const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const adminRoutes = require("./routes/admin");
const publicRoutes = require("./routes/public");
const pagesRoutes = require("./routes/pages");
const { publicDir, uploadsDir } = require("./config/paths");
const { env } = require("./config/env");
const { errorHandler } = require("./middleware/errorHandler");
const { apiLimiter } = require("./middleware/rateLimit");

function createApp() {
  const app = express();

  // CapRover proxies through nginx, so the real client IP only reaches the
  // app in X-Forwarded-For. Trust the configured number of hops so the rate
  // limiter buckets per visitor instead of per proxy. Set before any
  // middleware reads req.ip.
  app.set("trust proxy", env.trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(
    morgan(env.isProd ? "combined" : "dev", {
      skip: (req) => req.path === "/api/health",
    })
  );

  // Keep JSON endpoints out of search results while allowing crawlers to
  // fetch the public catalog when rendering the menu page.
  app.use("/api", (req, res, next) => {
    res.setHeader("X-Robots-Tag", "noindex");
    next();
  });

  app.use("/api", apiLimiter);
  app.use("/api/admin", adminRoutes);
  app.use("/api", publicRoutes);
  app.use(pagesRoutes);

  // Uploaded photos are stored in UPLOAD_DIR, which in production is a
  // persistent volume mounted OUTSIDE public/. Serve them explicitly at
  // /uploads so the URLs the API returns (/uploads/<file>) keep working
  // regardless of where the files physically live.
  app.use("/uploads", express.static(uploadsDir, { fallthrough: true }));
  app.use(express.static(publicDir));
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
