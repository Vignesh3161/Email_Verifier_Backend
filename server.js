// server.js
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { bulkVerify } = require("./utils/verify");

const app = express();

/* =========================
   CORS CONFIG (IMPORTANT)
   ========================= */
app.use(
  cors({
    origin: "*", // allow all origins (for development)
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Handle preflight requests
app.options("*", cors());

// Large payload support
app.use(
  bodyParser.json({
    limit: "500mb",
  })
);

app.post("/verify", async (req, res) => {
  try {
    const emails = req.body.emails;

    if (!Array.isArray(emails)) {
      return res.status(400).json({ error: "emails must be an array" });
    }

    const start = Date.now();
    const results = await bulkVerify(emails);
    const end = Date.now();

    res.json({
      success: true,
      total: emails.length,
      time_taken_seconds: ((end - start) / 1000).toFixed(2),
      results,
    });
  } catch (err) {
    console.error("SERVER ERROR:", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

app.listen(3000, () =>
  console.log("🚀 Verification server running at http://localhost:3000")
);
