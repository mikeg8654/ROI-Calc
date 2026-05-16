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
