// server.js
const express = require("express");
const bodyParser = require("body-parser");
const { bulkVerify } = require("./utils/verify");

const app = express();

// Large payload support
app.use(
  bodyParser.json({
    limit: "500mb", // allow massive bulk lists
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
      total: emails.length,
      time_taken_seconds: ((end - start) / 1000).toFixed(2),
      results,
    });
  } catch (err) {
    console.error("SERVER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () =>
  console.log("🚀 Verification server running at http://localhost:3000")
);
