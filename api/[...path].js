// Vercel's file-based catch-all route serves every /api/* request through
// the same Express app. Static website files remain Vercel static assets.
const app = require("../server");

module.exports = app;
