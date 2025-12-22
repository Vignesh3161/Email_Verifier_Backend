// server.js
const express = require("express");
const cors = require("cors");
const { bulkVerify } = require("./utils/verify");

const app = express();

/* =========================
   CORS CONFIG
   ========================= */
app.use(
  cors({
    origin: "*", // development only
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/* =========================
   BODY PARSER (BUILT-IN)
   ========================= */
app.use(
  express.json({
    limit: "500mb",
  })
);

/* =========================
   VERIFY API
   ========================= */
app.post("/verify", async (req, res) => {
  try {
    const { emails } = req.body;

    if (!Array.isArray(emails)) {
      return res.status(400).json({
        success: false,
        message: "emails must be an array",
      });
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
      message: "Internal Server Error",
    });
  }
});

/* =========================
   SERVER START
   ========================= */
app.listen(3000, () => {
  console.log("🚀 Verification server running at http://localhost:3000");
});
