const dotenv = require("dotenv");
const path = require("path");

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
// Local Supabase overrides stay in a separate ignored file so deployment
// providers can continue to use their own environment-variable settings.
dotenv.config({
  path: path.resolve(__dirname, "../../.env.supabase"),
  override: true,
});

const config = {
  port: parseInt(process.env.PORT || "8080", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || "",
  encryptionKey: process.env.ENCRYPTION_KEY || "",
  jwtSecret: process.env.JWT_SECRET || "",
  adminPassword: process.env.ADMIN_PASSWORD || "",
};

module.exports = config;
