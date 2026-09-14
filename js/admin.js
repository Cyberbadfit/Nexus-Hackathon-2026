const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];

const token = () => sessionStorage.getItem("nexxus_admin_token");

const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );

let data = {
  participants: [],
  teams: [],
  problems: [],
  updates: [],
  tickets: [],
};

async function api(path, opts = {}) {
  const r = await fetch("/api" + path, {
    headers: {
      "Content-Type": "application/json",
      ...(token() ? { Authorization: "Bearer " + token() } : {}),
      ...(opts.headers || {}),
    },
    ...opts,
  });

  let d = {};

  try {
    d = await r.json();
  } catch {}

  if (!r.ok) throw new Error(d.error || "Request failed");

  return d;
}

const toast = (m) => {
  const t = $("#toast");
  t.textContent = m;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
};


/* =========================================================
   MODAL
========================================================= */

function closeModal() {
  const modal = $("#modal");

  if (modal) {
    modal.classList.remove("show");
  }
}

window.closeModal = closeModal;


// Modal close buttons + outside click
$("#modal")?.addEventListener("click", (e) => {
  // × button
  if (e.target.closest("#modal .close")) {
    e.preventDefault();
    closeModal();
    return;
  }

  // Cancel button
  if (e.target.closest("#modal .modal-foot .btn:not(.primary)")) {
    e.preventDefault();
    closeModal();
    return;
  }

  // Click outside modal box
  if (e.target === $("#modal")) {
    closeModal();
  }
});


// Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
  }
});


/* =========================================================
   LOGIN
========================================================= */

$("#login-form").onsubmit = async (e) => {
  e.preventDefault();

  try {
    const d = await api("/admin/login", {
      method: "POST",
      body: JSON.stringify({
        password: $("#password").value,
      }),
    });

    sessionStorage.setItem("nexxus_admin_token", d.token);

    showApp();
    loadAll();
  } catch (err) {
    $("#login-error").textContent = err.message;
  }
};


async function showApp() {
  try {
    await api("/admin/verify");
  } catch (e) {
    sessionStorage.removeItem("nexxus_admin_token");
    return;
  }

  $("#login").style.display = "none";
  $("#app").style.display = "flex";
}


if (token()) showApp();


/* =========================================================
   LOGOUT
========================================================= */

$("#logout").onclick = async () => {
  try {
    await api("/admin/logout", {
      method: "POST",
    });
  } catch {}

  sessionStorage.removeItem("nexxus_admin_token");
  location.reload();
};


/* =========================================================
   NAVIGATION
========================================================= */

function goto(name) {
  $$(".admin-section").forEach((x) =>
    x.classList.remove("active"),
  );

  $("#section-" + name).classList.add("active");

  $$(".sidebar-nav a").forEach((x) =>
    x.classList.toggle(
      "active",
      x.dataset.section === name,
    ),
  );

  $("#page-title").textContent =
    {
      dashboard: "Overview",
      participants: "Participants",
      teams: "Teams",
      problems: "Challenges",
      updates: "Updates",
      support: "Support",
    }[name] || name;

  location.hash = name;
}


$$(".sidebar-nav a").forEach(
  (a) =>
    (a.onclick = (e) => {
      e.preventDefault();
      goto(a.dataset.section);
    }),
);


$$("[data-go]").forEach(
  (b) => (b.onclick = () => goto(b.dataset.go)),
);


if (location.hash) {
  goto(location.hash.slice(1));
}


/* =========================================================
   LOAD DATA
========================================================= */

async function loadAll() {
  try {
    const [p, t, ps, u, s, h] = await Promise.all([
      api("/admin/candidates"),
      api("/admin/teams"),
      api("/problems"),
      api("/announcements"),
      api("/support/tickets"),
      api("/health"),
    ]);

    data.participants = p.candidates || [];
    data.teams = t.teams || [];
    data.problems = ps.problems || [];
    data.updates = u.announcements || [];
    data.tickets = s.tickets || [];

    $("#health").textContent = h.status || "ONLINE";

    render();
  } catch (e) {
    toast(e.message);
  }
}


$("#refresh").onclick = loadAll;


/* =========================================================
   RENDER EVERYTHING
========================================================= */

function render() {
  const pending = data.participants.filter(
    (x) =>
      String(x.status).toUpperCase() === "PENDING",
  ).length;

  $("#kpi-participants").textContent =
    data.participants.length;

  $("#kpi-teams").textContent =
    data.teams.length;

  $("#kpi-pending").textContent =
    pending;

  $("#kpi-problems").textContent =
    data.problems.filter(
      (p) => p.published,
    ).length;

  renderParticipants();
  renderTeams();
  renderProblems();
  renderUpdates();
  renderSupport();
}


/* =========================================================
   PARTICIPANTS
========================================================= */

function renderParticipants() {
  const q =
    ($("#participant-search")?.value || "")
      .toLowerCase();

  const st =
    $("#participant-status")?.value || "ALL";

  const rows = data.participants.filter(
    (c) =>
      (st === "ALL" ||
        String(c.status).toUpperCase() === st) &&
      [
        c.name,
        c.email,
        c.public_user_id,
        c.team_name,
        c.team_code,
        c.track,
      ].some((v) =>
        String(v || "")
          .toLowerCase()
          .includes(q),
      ),
  );

  $("#participants-table").innerHTML =
    rows
      .map(
        (c) =>
          `<tr>
            <td>
              <strong>${esc(c.name)}</strong>
              <br>
              <span class="muted">
                ${esc(c.email)} · ${esc(c.public_user_id)}
              </span>
            </td>

            <td>
              ${esc(c.team_name)}
              <br>
              <span class="muted">
                ${esc(c.team_code)}
              </span>
            </td>

            <td>
              ${esc(c.track || "Not selected")}
            </td>

            <td>
              ${esc(c.role)}
            </td>

            <td>
              <span class="badge ${
                String(c.status).toUpperCase() === "PENDING"
                  ? "warning"
                  : "success"
              }">
                ${esc(c.status)}
              </span>
            </td>

            <td class="row-actions">
              ${
                String(c.status).toUpperCase() === "PENDING"
                  ? `<button
                      class="btn success participant-approve"
                      data-id="${esc(c.id)}">
                      Approve
                    </button>`
                  : ""
              }

              <button
                class="btn danger participant-delete"
                data-id="${esc(c.id)}">
                Delete
              </button>
            </td>
          </tr>`,
      )
      .join("") ||
    '<tr><td colspan="6" class="empty">No participants found.</td></tr>';
}


$("#participant-search").oninput =
  renderParticipants;

$("#participant-status").onchange =
  renderParticipants;


/* =========================================================
   PARTICIPANT ACTIONS
========================================================= */

window.approve = async (id) => {
  try {
    await api(
      "/admin/candidates/" + id + "/approve",
      {
        method: "PATCH",
      },
    );

    toast("Participant approved");

    loadAll();
  } catch (e) {
    toast(e.message);
  }
};


window.removeParticipant = async (id) => {
  if (!confirm("Delete this participant?")) return;

  try {
    const result = await api(
      "/admin/candidates/" + id,
      {
        method: "DELETE",
      },
    );

    // The API returns only after Supabase has returned the deleted row. Update
    // immediately, then re-fetch to keep all dashboard counts in sync.
    data.participants = data.participants.filter(
      (participant) => participant.id !== result.deletedUserId,
    );
    render();
    await loadAll();

    toast("Participant deleted from the database");
  } catch (e) {
    toast(e.message);
  }
};


/* =========================================================
   TEAMS
========================================================= */

function renderTeams() {
  const q =
    ($("#team-search")?.value || "")
      .toLowerCase();

  const rows = data.teams.filter((t) =>
    [
      t.name,
      t.team_id,
      t.leaderName,
      t.track,
    ].some((v) =>
      String(v || "")
        .toLowerCase()
        .includes(q),
    ),
  );

  $("#teams-table").innerHTML =
    rows
      .map((t) => {
        const p = data.problems.find(
          (x) =>
            x.id === t.problem_statement_id,
        );

        return `
          <tr>
            <td>
              <strong>${esc(t.name)}</strong>
              <br>
              <span class="muted">
                ${esc(t.leaderName)}
              </span>
            </td>

            <td>
              ${esc(t.team_id)}
            </td>

            <td>
              ${t.memberCount}/4
            </td>

            <td>
              ${esc(t.track || "Not selected")}
            </td>

            <td>
              ${esc(p?.code || "Not selected")}
            </td>

            <td>
              <button
                class="btn team-manage"
                data-id="${esc(t.id)}">
                Manage
              </button>
            </td>
          </tr>
        `;
      })
      .join("") ||
    '<tr><td colspan="6" class="empty">No teams found.</td></tr>';
}


$("#team-search").oninput =
  renderTeams;


/* =========================================================
   EDIT TEAM
========================================================= */

window.editTeam = (id) => {
  const t = data.teams.find(
    (x) =>
      String(x.id) === String(id),
  );

  if (!t) return;

  $("#modal-title").textContent =
    "Manage team";

  $("#modal-body").innerHTML =
    `<div class="modal-form">
      <div class="field">
        <label>Team name</label>
        <input
          id="m-team-name"
          value="${esc(t.name)}">
      </div>

      <div class="field">
        <label>Problem statement</label>

        <select id="m-team-ps">
          <option value="">
            Not selected
          </option>

          ${data.problems
            .filter((p) => p.published)
            .map(
              (p) =>
                `<option
                  value="${esc(p.id)}"
                  ${
                    String(
                      t.problem_statement_id,
                    ) === String(p.id)
                      ? "selected"
                      : ""
                  }>
                  ${esc(p.code)} — ${esc(p.title)}
                </option>`,
            )
            .join("")}
        </select>
      </div>

      <div class="notice">
        Selecting a problem statement automatically
        makes its track the team's classification.
        Participants do not select a track separately.
      </div>
    </div>`;

  $("#modal-save").onclick = async (e) => {
    e.preventDefault();

    try {
      const ps = data.problems.find(
        (p) =>
          String(p.id) ===
          $("#m-team-ps").value,
      );

      await api(
        "/admin/teams/" + id,
        {
          method: "PATCH",
          body: JSON.stringify({
            name:
              $("#m-team-name")
                .value
                .trim(),

            problem_statement_id:
              $("#m-team-ps").value ||
              null,

            track:
              ps?.track ||
              "Unassigned",
          }),
        },
      );

      closeModal();

      toast("Team updated");

      loadAll();
    } catch (e) {
      toast(e.message);
    }
  };

  $("#modal").classList.add("show");
};


/* =========================================================
   PROBLEMS
========================================================= */

function renderProblems() {
  $("#problem-admin-grid").innerHTML =
    data.problems
      .map(
        (p) =>
          `<article class="card ps-card">
            <div class="problem-meta">
              <span class="badge accent">
                ${esc(p.code)}
              </span>

              <span class="badge">
                ${esc(p.track)}
              </span>

              <span class="badge ${
                p.published
                  ? "success"
                  : "warning"
              }">
                ${
                  p.published
                    ? "Published"
                    : "Draft"
                }
              </span>
            </div>

            <h3>
              ${esc(p.title)}
            </h3>

            <p>
              ${esc(
                p.summary ||
                  p.description,
              )}
            </p>

            <div
              class="row-actions"
              style="margin-top:14px">

              <button
                class="btn problem-edit"
                data-id="${esc(p.id)}">
                Edit
              </button>

              <button
                class="btn danger problem-delete"
                data-id="${esc(p.id)}">
                Delete
              </button>

            </div>
          </article>`,
      )
      .join("") ||
    '<div class="empty">No problem statements yet.</div>';
}


/* =========================================================
   PROBLEM FORM
========================================================= */

function problemForm(p = {}) {
  return `
    <div class="modal-form">
      <div class="form-grid">

        <div class="field">
          <label>Code</label>
          <input
            id="p-code"
            value="${esc(p.code || "")}"
            placeholder="PS-001">
        </div>

        <div class="field">
          <label>Track / category</label>
          <input
            id="p-track"
            value="${esc(p.track || "")}"
            placeholder="AI, Sustainability, Open Innovation…">
        </div>

        <div class="field full">
          <label>Title *</label>
          <input
            id="p-title"
            value="${esc(p.title || "")}"
            required>
        </div>

        <div class="field full">
          <label>Short summary</label>
          <textarea id="p-summary">${esc(
            p.summary || "",
          )}</textarea>
        </div>

        <div class="field full">
          <label>Full problem statement</label>
          <textarea id="p-description">${esc(
            p.description || "",
          )}</textarea>
        </div>

        <div class="field">
          <label>Difficulty</label>

          <select id="p-difficulty">
            <option ${
              p.difficulty === "Beginner"
                ? "selected"
                : ""
            }>
              Beginner
            </option>

            <option ${
              p.difficulty === "Intermediate" ||
              !p.difficulty
                ? "selected"
                : ""
            }>
              Intermediate
            </option>

            <option ${
              p.difficulty === "Advanced"
                ? "selected"
                : ""
            }>
              Advanced
            </option>
          </select>
        </div>

        <div class="field">
          <label>Suggested technologies</label>
          <input
            id="p-tech"
            value="${esc(
              p.technologies || "",
            )}">
        </div>

        <div class="field full">
          <label>Constraints</label>
          <textarea id="p-constraints">${esc(
            p.constraints || "",
          )}</textarea>
        </div>

        <div class="field full">
          <label>Expected outcome</label>
          <textarea id="p-outcome">${esc(
            p.expected_outcome || "",
          )}</textarea>
        </div>

        <div class="field full">
          <label>Judging focus</label>
          <textarea id="p-judging">${esc(
            p.judging_focus || "",
          )}</textarea>
        </div>

        <div class="field">
          <label>Visibility</label>

          <select id="p-published">
            <option
              value="true"
              ${
                p.published !== false
                  ? "selected"
                  : ""
              }>
              Published
            </option>

            <option
              value="false"
              ${
                p.published === false
                  ? "selected"
                  : ""
              }>
              Draft
            </option>
          </select>
        </div>

      </div>
    </div>
  `;
}


$("#new-problem").onclick =
  () => editProblem();


/* =========================================================
   EDIT / CREATE PROBLEM
========================================================= */

window.editProblem = (pId) => {
  const p =
    data.problems.find(
      (x) =>
        String(x.id) ===
        String(pId),
    ) || {};

  $("#modal-title").textContent =
    pId
      ? "Edit challenge"
      : "New challenge";

  $("#modal-body").innerHTML =
    problemForm(p);

  $("#modal-save").onclick = async (e) => {
    e.preventDefault();

    const payload = {
      code:
        $("#p-code")
          .value
          .trim() ||
        undefined,

      track:
        $("#p-track")
          .value
          .trim() ||
        "General",

      title:
        $("#p-title")
          .value
          .trim(),

      summary:
        $("#p-summary")
          .value
          .trim(),

      description:
        $("#p-description")
          .value
          .trim(),

      difficulty:
        $("#p-difficulty").value,

      technologies:
        $("#p-tech")
          .value
          .trim(),

      constraints:
        $("#p-constraints")
          .value
          .trim(),

      expected_outcome:
        $("#p-outcome")
          .value
          .trim(),

      judging_focus:
        $("#p-judging")
          .value
          .trim(),

      published:
        $("#p-published")
          .value === "true",
    };

    if (!payload.title) {
      return toast("Title is required");
    }

    try {
      await api(
        pId
          ? "/problems/" + pId
          : "/problems",
        {
          method: pId
            ? "PATCH"
            : "POST",

          body: JSON.stringify(
            payload,
          ),
        },
      );

      closeModal();

      toast("Challenge saved");

      loadAll();
    } catch (e) {
      toast(e.message);
    }
  };

  $("#modal").classList.add("show");
};


/* =========================================================
   DELETE PROBLEM
========================================================= */

window.deleteProblem = async (id) => {
  if (
    !confirm(
      "Delete this problem statement?",
    )
  ) {
    return;
  }

  try {
    await api(
      "/problems/" + id,
      {
        method: "DELETE",
      },
    );

    await loadAll();

    toast("Challenge deleted from the database");
  } catch (e) {
    toast(e.message);
  }
};


/* =========================================================
   UPDATES
========================================================= */

function renderUpdates() {
  $("#updates-admin").innerHTML =
    data.updates
      .map(
        (x) =>
          `<div
            class="roster-row"
            style="margin-bottom:9px">

            <div>
              <strong>
                ${esc(x.title)}
              </strong>

              <br>

              <span class="muted">
                ${esc(x.category)}
                ·
                ${esc(x.priority)}
              </span>

              <p
                class="muted"
                style="font-size:12px;margin-top:4px">
                ${esc(x.content)}
              </p>
            </div>

            <div class="row-actions">

              <button
                class="btn update-edit"
                data-id="${esc(x.id)}">
                Edit
              </button>

              <button
                class="btn danger update-delete"
                data-id="${esc(x.id)}">
                Delete
              </button>

            </div>
          </div>`,
      )
      .join("") ||
    '<div class="empty">No announcements.</div>';
}


/* =========================================================
   UPDATE FORM
========================================================= */

function updateForm(x = {}) {
  return `
    <div class="modal-form">

      <div class="field">
        <label>Title</label>

        <input
          id="u-title"
          value="${esc(
            x.title || "",
          )}">
      </div>

      <div class="form-grid">

        <div class="field">
          <label>Category</label>

          <input
            id="u-category"
            value="${esc(
              x.category ||
                "General",
            )}">
        </div>

        <div class="field">
          <label>Priority</label>

          <select id="u-priority">

            <option ${
              x.priority === "Critical"
                ? "selected"
                : ""
            }>
              Critical
            </option>

            <option ${
              x.priority === "High" ||
              !x.priority
                ? "selected"
                : ""
            }>
              High
            </option>

            <option ${
              x.priority === "Normal"
                ? "selected"
                : ""
            }>
              Normal
            </option>

          </select>
        </div>

      </div>

      <div class="field">
        <label>Message</label>

        <textarea id="u-content">${esc(
          x.content || "",
        )}</textarea>
      </div>

    </div>
  `;
}


$("#new-update").onclick =
  () => editUpdate();


/* =========================================================
   EDIT / CREATE UPDATE
========================================================= */

window.editUpdate = (id) => {
  const x =
    data.updates.find(
      (a) =>
        String(a.id) ===
        String(id),
    ) || {};

  $("#modal-title").textContent =
    id
      ? "Edit update"
      : "New update";

  $("#modal-body").innerHTML =
    updateForm(x);

  $("#modal-save").onclick = async (e) => {
    e.preventDefault();

    const payload = {
      title:
        $("#u-title")
          .value
          .trim(),

      category:
        $("#u-category")
          .value
          .trim(),

      priority:
        $("#u-priority").value,

      track:
        "All challenges",

      content:
        $("#u-content")
          .value
          .trim(),
    };

    try {
      await api(
        id
          ? "/announcements/" + id
          : "/announcements",
        {
          method: id
            ? "PATCH"
            : "POST",

          body: JSON.stringify(
            payload,
          ),
        },
      );

      closeModal();

      toast("Update saved");

      loadAll();
    } catch (e) {
      toast(e.message);
    }
  };

  $("#modal").classList.add("show");
};


/* =========================================================
   DELETE UPDATE
========================================================= */

window.deleteUpdate = async (id) => {
  if (
    !confirm(
      "Delete this update?",
    )
  ) {
    return;
  }

  try {
    await api(
      "/announcements/" + id,
      {
        method: "DELETE",
      },
    );

    await loadAll();

    toast("Update deleted from the database");
  } catch (e) {
    toast(e.message);
  }
};


/* =========================================================
   SUPPORT
========================================================= */

function renderSupport() {
  $("#support-admin").innerHTML =
    data.tickets
      .map(
        (t) =>
          `<div
            class="roster-row"
            style="margin-bottom:9px">

            <div>

              <strong>
                ${esc(
                  t.ticket_id ||
                    t.id,
                )}
              </strong>

              ·

              ${esc(t.name)}

              <br>

              <span class="muted">
                ${esc(t.email)}
                ·
                ${esc(
                  t.category ||
                    "Other",
                )}
              </span>

              <p
                style="font-size:12px;margin-top:5px">
                ${esc(t.message)}
              </p>

            </div>

            <button
              class="btn ${
                t.status === "RESOLVED"
                  ? "success"
                  : ""
              } support-resolve"
              data-id="${esc(t.id)}">

              ${
                t.status === "RESOLVED"
                  ? "Resolved"
                  : "Resolve"
              }

            </button>

          </div>`,
      )
      .join("") ||
    '<div class="empty">No support tickets.</div>';
}


/* =========================================================
   RESOLVE SUPPORT TICKET
========================================================= */

window.resolveTicket = async (id) => {
  try {
    await api(
      "/support/tickets/" + id,
      {
        method: "PATCH",

        body: JSON.stringify({
          status: "RESOLVED",
        }),
      },
    );

    toast("Ticket resolved");

    loadAll();
  } catch (e) {
    toast(e.message);
  }
};


/* =========================================================
   EVENT DELEGATION FOR ALL DYNAMIC BUTTONS
========================================================= */

/*
  IMPORTANT:

  The buttons inside Participants, Teams, Challenges,
  Updates and Support are generated dynamically.

  Instead of inline onclick="..." handlers,
  we handle them here using data-id attributes.

  This makes the buttons work even when the HTML
  is regenerated by render().
*/

document.addEventListener("click", (e) => {

  /* -------------------------
     PARTICIPANTS
  ------------------------- */

  const approveButton =
    e.target.closest(
      ".participant-approve",
    );

  if (approveButton) {
    const id =
      approveButton.dataset.id;

    if (id) {
      window.approve(id);
    }

    return;
  }


  const participantDeleteButton =
    e.target.closest(
      ".participant-delete",
    );

  if (participantDeleteButton) {
    const id =
      participantDeleteButton.dataset.id;

    if (id) {
      window.removeParticipant(id);
    }

    return;
  }


  /* -------------------------
     TEAMS
  ------------------------- */

  const teamManageButton =
    e.target.closest(
      ".team-manage",
    );

  if (teamManageButton) {
    const id =
      teamManageButton.dataset.id;

    if (id) {
      window.editTeam(id);
    }

    return;
  }


  /* -------------------------
     PROBLEMS
  ------------------------- */

  const problemEditButton =
    e.target.closest(
      ".problem-edit",
    );

  if (problemEditButton) {
    const id =
      problemEditButton.dataset.id;

    if (id) {
      window.editProblem(id);
    }

    return;
  }


  const problemDeleteButton =
    e.target.closest(
      ".problem-delete",
    );

  if (problemDeleteButton) {
    const id =
      problemDeleteButton.dataset.id;

    if (id) {
      window.deleteProblem(id);
    }

    return;
  }


  /* -------------------------
     UPDATES
  ------------------------- */

  const updateEditButton =
    e.target.closest(
      ".update-edit",
    );

  if (updateEditButton) {
    const id =
      updateEditButton.dataset.id;

    if (id) {
      window.editUpdate(id);
    }

    return;
  }


  const updateDeleteButton =
    e.target.closest(
      ".update-delete",
    );

  if (updateDeleteButton) {
    const id =
      updateDeleteButton.dataset.id;

    if (id) {
      window.deleteUpdate(id);
    }

    return;
  }


  /* -------------------------
     SUPPORT
  ------------------------- */

  const supportResolveButton =
    e.target.closest(
      ".support-resolve",
    );

  if (supportResolveButton) {
    const id =
      supportResolveButton.dataset.id;

    if (id) {
      window.resolveTicket(id);
    }

    return;
  }

});


/* =========================================================
   EXPORT CSV
========================================================= */

$("#export").onclick = async () => {
  try {
    const r = await fetch(
      "/api/admin/export-csv",
      {
        headers: {
          Authorization:
            "Bearer " + token(),
        },
      },
    );

    if (!r.ok) {
      throw new Error(
        "Export failed",
      );
    }

    const blob =
      await r.blob();

    const a =
      document.createElement("a");

    a.href =
      URL.createObjectURL(blob);

    a.download =
      "nexxathon-participants.csv";

    a.click();

    URL.revokeObjectURL(
      a.href,
    );
  } catch (e) {
    toast(e.message);
  }
};
