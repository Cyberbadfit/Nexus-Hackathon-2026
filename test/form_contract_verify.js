const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const client = fs.readFileSync(path.join(root, "js", "public.js"), "utf8");
const adminClient = fs.readFileSync(path.join(root, "js", "admin.js"), "utf8");
const teamRoute = fs.readFileSync(
  path.join(root, "server", "routes", "teamRoutes.js"),
  "utf8",
);
const service = fs.readFileSync(
  path.join(root, "server", "services", "supabaseService.js"),
  "utf8",
);

test("registration fields match their browser selectors", () => {
  for (const id of [
    "leader-institution",
    "leader-year",
    "member-institution",
    "member-year",
    "member-branch",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
    assert.match(client, new RegExp(`#${id}`));
  }
});

test("academic year is submitted and persisted for team leaders and members", () => {
  assert.match(client, /leaderYear: \$\("#leader-year"\)\.value\.trim\(\)/);
  assert.match(client, /year: \$\("#member-year"\)\.value\.trim\(\)/);
  assert.match(teamRoute, /leaderYear,/);
  assert.match(teamRoute, /\$\{leaderYear\}\|APPROVED/);
  assert.match(teamRoute, /\$\{year\}\|PENDING/);
});

test("Supabase write failures cannot be reported as in-memory successes", () => {
  assert.doesNotMatch(service, /memoryCache/);
  assert.match(service, /The database could not save this request/);
  assert.match(service, /SUPABASE_SECRET_KEY/);
});

test("admin deletion requires Supabase to return the deleted record", () => {
  assert.match(service, /async deleteOne\(table, id, label\)/);
  assert.match(service, /returnRepresentation: true/);
  assert.match(service, /deleted\.length !== 1/);
  assert.match(service, /async deleteParticipant\(userId\)/);
  assert.match(service, /deleteTeamMembersByUserId\(userId\)/);
  assert.match(service, /clearTeamLeadershipByUserId\(userId\)/);
  assert.match(service, /clearProblemSelectionById\(id\)/);
  assert.match(adminClient, /participant\.id !== result\.deletedUserId/);
  assert.match(adminClient, /Participant deleted from the database/);
});

test("the browser API ends stalled requests with a user-visible error", () => {
  const api = fs.readFileSync(path.join(root, "js", "api.js"), "utf8");
  assert.match(api, /new AbortController\(\)/);
  assert.match(api, /timeoutMs = 15000/);
  assert.match(api, /The server did not respond/);
});

test("team WhatsApp invitations include the live registration URL", () => {
  assert.match(
    client,
    /https:\/\/nexus-hackathon-2026-three\.vercel\.app\//,
  );
});
