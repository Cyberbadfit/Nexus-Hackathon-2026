const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const cors = require("cors");
const origins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      // Helmet enables this by default. On a LAN preview it rewrites relative
      // CSS and JS requests from http://192.168.x.x to HTTPS, where this local
      // Express server is not listening, leaving the page unstyled.
      "upgrade-insecure-requests": null,
    },
  },
  crossOriginEmbedderPolicy: false,
});
function isSameOriginRequest(req, origin) {
  const protocol = (req.get("x-forwarded-proto") || req.protocol || "http")
    .split(",")[0]
    .trim();
  const host = (req.get("x-forwarded-host") || req.get("host") || "")
    .split(",")[0]
    .trim();
  return Boolean(host) && origin === `${protocol}://${host}`;
}

const configuredCors = cors({
  origin: true,
  credentials: false,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});
const corsMiddleware = (req, res, next) => {
  const origin = req.get("origin");
  const allowed =
    !origin ||
    origins.length === 0 ||
    origins.includes(origin) ||
    isSameOriginRequest(req, origin);

  if (!allowed)
    return res.status(403).json({ success: false, error: "CORS origin not allowed" });

  return configuredCors(req, res, next);
};
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many requests. Please try again shortly.",
  },
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many login attempts. Please try again later.",
  },
});
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Registration rate limit reached. Please try again later.",
  },
});
module.exports = {
  helmetMiddleware,
  corsMiddleware,
  apiLimiter,
  loginLimiter,
  registrationLimiter,
};
