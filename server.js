const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const runWorker = require("./workerPool");

const app = express();

app.use(cors());

// 🔐 rate limit
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 2,
  })
);

// JSON input
app.use(express.json({ limit: "10mb" }));

// TEXT input
app.use(express.text({ type: "text/plain", limit: "10mb" }));

const MAX_EMAILS = 10000;
const WORKERS = 6;

// ---------- parse emails ----------
function extractEmails(req) {
  // JSON format
  if (Array.isArray(req.body?.emails)) {
    return req.body.emails;
  }

  // Plain text format
  if (typeof req.body === "string") {
    return req.body
      .split(/\r?\n/)
      .map((e) => e.replace(/"/g, "").trim())
      .filter(Boolean);
  }

  return null;
}

// ---------- API ----------
app.post("/verify", async (req, res) => {
  try {
    const emails = extractEmails(req);

    if (!Array.isArray(emails)) {
      return res.status(400).json({
        success: false,
        message: "Invalid input format",
      });
    }

    if (emails.length > MAX_EMAILS) {
      return res.status(413).json({
        success: false,
        message: `Max ${MAX_EMAILS} emails per request`,
      });
    }

    const chunkSize = Math.ceil(emails.length / WORKERS);
    const chunks = [];

    for (let i = 0; i < emails.length; i += chunkSize) {
      chunks.push(emails.slice(i, i + chunkSize));
    }

    const start = Date.now();
    const results = [];

    for (const chunk of chunks) {
      const r = await runWorker(chunk);
      results.push(...r);
    }

    res.json({
      success: true,
      total: emails.length,
      time_seconds: ((Date.now() - start) / 1000).toFixed(2),
      results,
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.listen(3000, () =>
  console.log("🚀 SAFE Email Verifier running on port 3000")
);
