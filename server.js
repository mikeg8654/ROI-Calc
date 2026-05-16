// Express server for the ROI calc app.
//
// Routes:
//   /             → index.html (Inquiry Studio / Agency Lookup)
//   /calc         → calc/index.html (legacy v2.3.1 ROI Calculator)
//   /proposal     → proposal/index.html (Year-1 Partnership MVP)
//   /proposal/srvfpd → proposal/srvfpd/index.html (Discovery Engagement MVP)
//   /footprint    → footprint/index.html (National Footprint asset)
//   /login        → login.html (company-shared password gate)
//
// Authentication:
//   If ROI_CALC_PASSWORD env var is set, all routes are gated behind a
//   signed-cookie session. Login lives at /login. Static assets under
//   /*/assets/* remain public (for the login page background image, etc).
//   Auth is intentionally lightweight — single shared password for the
//   whole company, separate from Pulse's Mike-only gate.
//
//   To bypass auth in local dev, leave ROI_CALC_PASSWORD unset.

const crypto = require("node:crypto");
const path = require("node:path");
const express = require("express");
const cookieParser = require("cookie-parser");

const app = express();
const port = Number(process.env.PORT) || 3000;
const ROOT = __dirname;

const PASSWORD = process.env.ROI_CALC_PASSWORD || "";
const AUTH_SECRET =
  process.env.ROI_CALC_AUTH_SECRET ||
  // Stable per-process secret if none provided. Sessions reset on deploy
  // but that's acceptable for an internal tool.
  crypto.randomBytes(32).toString("hex");
const COOKIE_NAME = "roicalc_auth";
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function signToken(value) {
  return crypto.createHmac("sha256", AUTH_SECRET).update(value).digest("hex");
}

function isAuthed(req) {
  if (!PASSWORD) return true; // auth disabled when no password configured
  const raw = req.cookies?.[COOKIE_NAME];
  if (!raw) return false;
  const [issuedAt, sig] = raw.split(".");
  if (!issuedAt || !sig) return false;
  const expectedSig = signToken(issuedAt);
  if (
    sig.length !== expectedSig.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
  ) {
    return false;
  }
  const ageMs = Date.now() - parseInt(issuedAt, 10);
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs < COOKIE_MAX_AGE_MS;
}

app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// --- 1. Public routes (never gated) ---

app.get("/login", (_req, res) => {
  res.sendFile(path.join(ROOT, "login.html"));
});

app.post("/api/login", (req, res) => {
  const pw = (req.body?.password ?? "").trim();
  if (!PASSWORD) {
    // Auth disabled — just send them to /
    res.redirect("/");
    return;
  }
  if (pw !== PASSWORD) {
    res.redirect("/login?err=1");
    return;
  }
  const issuedAt = String(Date.now());
  const token = `${issuedAt}.${signToken(issuedAt)}`;
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  });
  const redir = typeof req.query.next === "string" && req.query.next.startsWith("/")
    ? req.query.next
    : "/";
  res.redirect(redir);
});

app.post("/api/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.redirect("/login");
});

// Login page references the white wordmark from /footprint/assets/. Serve
// that single asset publicly so the login page can render before auth.
app.get("/footprint/assets/md-ally-logo-white.png", (_req, res) => {
  res.sendFile(path.join(ROOT, "footprint", "assets", "md-ally-logo-white.png"));
});

// --- 2. Gate everything else ---

app.use((req, res, next) => {
  if (isAuthed(req)) return next();
  if (req.method === "GET" && req.accepts("html")) {
    const next = encodeURIComponent(req.originalUrl);
    res.redirect(`/login?next=${next}`);
    return;
  }
  res.status(401).json({ error: "auth required" });
});

// --- 3. Explicit page routes ---

app.get(["/calc", "/calc/"], (_req, res) => {
  res.sendFile(path.join(ROOT, "calc", "index.html"));
});
app.get(["/proposal", "/proposal/"], (_req, res) => {
  res.sendFile(path.join(ROOT, "proposal", "index.html"));
});
// Legacy /proposal/srvfpd → permanent redirect to the data-driven URL.
// Preserves links shared before the proposal generator was unified.
app.get(["/proposal/srvfpd", "/proposal/srvfpd/"], (_req, res) => {
  res.redirect(301, "/proposal/?dealId=60218142549");
});
app.get(["/footprint", "/footprint/"], (_req, res) => {
  res.sendFile(path.join(ROOT, "footprint", "index.html"));
});

// --- 3.5 Pulse /api/agency-brief proxy (employee-facing Meeting Intel) ---
//
// Pulse's brief endpoint is bearer-key gated. Rather than exposing the key
// to the browser, we proxy server-side: the frontend hits same-origin
// /api/agency-brief, this server attaches X-Pulse-Brief-Key from env, and
// forwards to Pulse. Keeps the key off the client + means the only auth
// the employee needs is the (optional) roi-calc password gate above.
//
// Requires PULSE_BRIEF_KEY on the Railway service. Without it, the proxy
// responds 503 so the UI can surface a clear "not configured" message.

const PULSE_API_BASE =
  process.env.PULSE_API_BASE ||
  "https://pulse-production-71ee.up.railway.app";

async function proxyAgencyBrief(req, res, pulsePath) {
  // When PULSE_BRIEF_KEY is set on this server, we attach it as the
  // bearer header. Pulse's /api/agency-brief honors this when its own
  // PULSE_BRIEF_KEY env is set; if Pulse has no key configured, the
  // endpoint is open and the header is harmless. So missing-env on
  // either side is fine — don't 503.
  const key = process.env.PULSE_BRIEF_KEY;
  try {
    const headers = { "Content-Type": "application/json" };
    if (key) headers["X-Pulse-Brief-Key"] = key;
    const init = { method: req.method, headers };
    if (["POST", "PUT", "PATCH"].includes(req.method) && req.body) {
      init.body = JSON.stringify(req.body);
    }
    const upstream = await fetch(`${PULSE_API_BASE}${pulsePath}`, init);
    const ct = upstream.headers.get("content-type") || "";
    res.status(upstream.status);
    if (ct) res.setHeader("Content-Type", ct);
    const cd = upstream.headers.get("content-disposition");
    if (cd) res.setHeader("Content-Disposition", cd);
    res.setHeader("Cache-Control", "no-store");
    if (ct.includes("application/json")) {
      const data = await upstream.json();
      res.json(data);
    } else {
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.send(buf);
    }
  } catch (err) {
    res.status(502).json({
      error: "Upstream Pulse unavailable: " + (err && err.message ? err.message : String(err)),
    });
  }
}

app.post("/api/agency-brief", (req, res) =>
  proxyAgencyBrief(req, res, "/api/agency-brief"),
);
app.get("/api/agency-brief", (req, res) => {
  const briefId = req.query.brief_id;
  if (!briefId) {
    res.status(400).json({ error: "brief_id required" });
    return;
  }
  proxyAgencyBrief(
    req,
    res,
    `/api/agency-brief?brief_id=${encodeURIComponent(String(briefId))}`,
  );
});
app.get("/api/agency-brief/:id/pdf", (req, res) =>
  proxyAgencyBrief(
    req,
    res,
    `/api/agency-brief/${encodeURIComponent(req.params.id)}/pdf`,
  ),
);
app.get("/api/agency-brief/:id/pptx", (req, res) =>
  proxyAgencyBrief(
    req,
    res,
    `/api/agency-brief/${encodeURIComponent(req.params.id)}/pptx`,
  ),
);

// --- 4. Static files from repo root ---

app.use(express.static(ROOT, { extensions: ["html"] }));

// --- 5. SPA fallback → Inquiry Studio ---

app.get("*", (_req, res) => {
  res.sendFile(path.join(ROOT, "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(
    `ROI calc listening on 0.0.0.0:${port}  ${PASSWORD ? "[auth: ENABLED]" : "[auth: DISABLED — set ROI_CALC_PASSWORD to enable]"}`,
  );
});
