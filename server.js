const express = require("express");
const cors = require("cors");
const bulkVerify = require("./utils/bulkVerify");

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));

const MAX_EMAILS_PER_REQUEST = 2000;

app.post("/verify", async (req, res) => {
  try {
    const { emails } = req.body;

    if (!Array.isArray(emails)) {
      return res.status(400).json({
        success: false,
        message: "emails must be an array",
      });
    }

    if (emails.length > MAX_EMAILS_PER_REQUEST) {
      return res.status(413).json({
        success: false,
        message: `Maximum ${MAX_EMAILS_PER_REQUEST} emails per request`,
      });
    }

    const start = Date.now();
    const results = await bulkVerify(emails);
    const end = Date.now();

    res.json({
      success: true,
      verified: emails.length,
      time_seconds: ((end - start) / 1000).toFixed(2),
      results,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

app.listen(3000, () => {
  console.log("🚀 Bulk verification server running on port 3000");
});
