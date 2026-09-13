const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const app = require("../server");

test("health endpoint reports the backend is online", async () => {
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const response = await new Promise((resolve, reject) => {
      const request = http.get(
        {
          host: "127.0.0.1",
          path: "/api/health",
          port,
        },
        (res) => {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            body += chunk;
          });
          res.on("end", () =>
            resolve({
              body,
              headers: res.headers,
              statusCode: res.statusCode,
            }),
          );
        },
      );
      request.on("error", reject);
    });

    assert.equal(response.statusCode, 200);
    const payload = JSON.parse(response.body);
    assert.deepEqual(payload, {
      status: "ONLINE",
      system: "NEXXUS / NEXXATHON",
      timestamp: payload.timestamp,
      environment: "development",
      maxTeamCapacity: 4,
      database: "CONFIGURED",
    });
    assert.match(payload.timestamp, /^\d{4}-\d{2}-\d{2}T/);
    assert.doesNotMatch(
      response.headers?.["content-security-policy"] || "",
      /upgrade-insecure-requests/,
    );
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("a deployed same-origin site can call its own API", async () => {
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const origin = `http://127.0.0.1:${port}`;
    const response = await new Promise((resolve, reject) => {
      const request = http.get(
        {
          host: "127.0.0.1",
          path: "/api/health",
          port,
          headers: { Origin: origin },
        },
        (res) => {
          res.resume();
          res.on("end", () =>
            resolve({
              allowOrigin: res.headers["access-control-allow-origin"],
              statusCode: res.statusCode,
            }),
          );
        },
      );
      request.on("error", reject);
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.allowOrigin, origin);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("LAN preview origin is allowed to call the API", async () => {
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const response = await new Promise((resolve, reject) => {
      const request = http.get(
        {
          host: "127.0.0.1",
          path: "/api/health",
          port,
          headers: { Origin: "http://192.168.1.11:8080" },
        },
        (res) => {
          res.resume();
          res.on("end", () =>
            resolve({
              allowOrigin: res.headers["access-control-allow-origin"],
              statusCode: res.statusCode,
            }),
          );
        },
      );
      request.on("error", reject);
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.allowOrigin, "http://192.168.1.11:8080");
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
