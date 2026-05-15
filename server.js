// Tiny Express server for the ROI calc app. Two top-level surfaces:
//   /             → index.html (Inquiry Studio)
//   /calc (and /calc/)  → calc/index.html (legacy v2.3.1 ROI Calculator)
// Everything else is served as static files from the repo root, with /
// as the SPA fallback so deeplinks like /?id=... still hit Inquiry.
//
// Replaces `serve -s` which was rewriting /calc, /calc/ AND /calc/index.html
// to /index.html via its overzealous SPA-fallback (cleanUrls collided with -s).

const path = require("node:path");
const express = require("express");

const app = express();
const port = Number(process.env.PORT) || 3000;
const ROOT = __dirname;

// 1. Explicit calc routes — must come before static so they take precedence.
app.get(["/calc", "/calc/"], (_req, res) => {
  res.sendFile(path.join(ROOT, "calc", "index.html"));
});
app.get(["/proposal", "/proposal/"], (_req, res) => {
  res.sendFile(path.join(ROOT, "proposal", "index.html"));
});
app.get(["/footprint", "/footprint/"], (_req, res) => {
  res.sendFile(path.join(ROOT, "footprint", "index.html"));
});

// 2. Static files from repo root (assets, /calc/*.css if any, etc.)
app.use(express.static(ROOT, { extensions: ["html"] }));

// 3. SPA fallback: anything else → inquiry shell (index.html)
app.get("*", (_req, res) => {
  res.sendFile(path.join(ROOT, "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`ROI calc app listening on 0.0.0.0:${port}`);
});
