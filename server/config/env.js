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

function normaliseSupabaseRestUrl(value) {
  const url = String(value || "").trim().replace(/\/+$/, "");
  if (!url || /\/rest\/v1$/i.test(url)) return url;
  return `${url}/rest/v1`;
}

const config = {
  port: parseInt(process.env.PORT || "8080", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  // Accept either the Supabase project URL or its PostgREST endpoint. This
  // prevents a production-only failure when a hosting dashboard is given the
  // project URL shown in Supabase instead of the longer REST URL.
  supabaseUrl: normaliseSupabaseRestUrl(process.env.SUPABASE_URL),
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || "",
  encryptionKey: process.env.ENCRYPTION_KEY || "",
  jwtSecret: process.env.JWT_SECRET || "",
  adminPassword: process.env.ADMIN_PASSWORD || "",
};

module.exports = config;
