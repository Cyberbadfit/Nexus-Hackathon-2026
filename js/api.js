const API = {
  async request(path, opts = {}) {
    const { timeoutMs = 15000, ...fetchOptions } = opts;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetch("/api" + path, {
        headers: {
          "Content-Type": "application/json",
          ...(fetchOptions.headers || {}),
        },
        ...fetchOptions,
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted)
        throw new Error("The server did not respond. Please try again shortly.");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
    let data = {};
    try {
      data = await res.json();
    } catch {}
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  },
  createTeam: (d) =>
    API.request("/teams/create", { method: "POST", body: JSON.stringify(d) }),
  verifyTeam: (c) => API.request("/teams/verify/" + encodeURIComponent(c)),
  joinTeam: (d) =>
    API.request("/teams/join", { method: "POST", body: JSON.stringify(d) }),
  status: (q) => API.request("/students/status/" + encodeURIComponent(q)),
  problems: () => API.request("/problems"),
  support: (d) =>
    API.request("/support/tickets", {
      method: "POST",
      body: JSON.stringify(d),
    }),
  announcements: () => API.request("/announcements"),
};
