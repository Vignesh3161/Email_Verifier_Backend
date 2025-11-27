// verify.js
const dns = require("dns").promises;
const https = require("https");
const net = require("net");
const validator = require("validator");

let disposableSet = null;

// ---------------------------------------------------------
// Fetch Disposable Domain List (Official TXT)
async function fetchDisposableSet() {
  if (disposableSet) return disposableSet;

  return new Promise((resolve) => {
    https.get(
      "https://disposable.github.io/disposable-email-domains/domains.txt",
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const lines = data
              .split(/\r?\n/)
              .map((l) => l.trim().toLowerCase())
              .filter(Boolean);

            disposableSet = new Set(lines);
            console.log("✔ Disposable domains loaded:", disposableSet.size);
            resolve(disposableSet);
          } catch (err) {
            console.error("❌ Parse error:", err.message);
            disposableSet = new Set();
            resolve(disposableSet);
          }
        });
      }
    ).on("error", (err) => {
      console.error("❌ Fetch disposable list failed:", err.message);
      disposableSet = new Set();
      resolve(disposableSet);
    });
  });
}

// ---------------------------------------------------------
// Syntax Check
function checkSyntax(email) {
  return validator.isEmail(email);
}

// ---------------------------------------------------------
// Disposable Check
async function isDisposable(email) {
  const domain = email.split("@")[1]?.toLowerCase();
  const set = await fetchDisposableSet();
  return set.has(domain);
}

// ---------------------------------------------------------
// DNS & MX Checks
async function checkDNS(domain) {
  try {
    const a = await dns.resolve(domain);
    return a.length > 0;
  } catch {
    return false;
  }
}

async function checkMX(domain) {
  try {
    const mx = await dns.resolveMx(domain);
    return mx && mx.length > 0 ? mx : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------
// Catch-All Detection (Non-SMTP)
async function detectCatchAll(domain) {
  try {
    const a = await dns.resolve(domain);
    return a.length > 0; // domain resolves → possible catch-all
  } catch {
    return false;
  }
}

// ---------------------------------------------------------
// Domain Health Score (internal)
function domainHealth(mxRecords) {
  if (!mxRecords || mxRecords.length === 0) return "bad";

  const mx = mxRecords[0].exchange.toLowerCase();
  if (
    mx.includes("google") ||
    mx.includes("outlook") ||
    mx.includes("yahoo") ||
    mx.includes("secureserver") ||
    mx.includes("zoho")
  )
    return "excellent";

  if (mx.includes("mail") || mx.includes("smtp")) return "good";
  return "unknown";
}

// ---------------------------------------------------------
// SMTP Light Check (optional)
async function smtpCheck(mxRecord) {
  return new Promise((resolve) => {
    const socket = net.createConnection(25, mxRecord.exchange);

    let response = "";
    let finished = false;

    const timeout = setTimeout(() => {
      if (!finished) {
        finished = true;
        socket.destroy();
        resolve({ smtp: false, smtp_reason: "timeout" });
      }
    }, 6000);

    socket.on("data", (data) => {
      response += data.toString();

      if (response.includes("220")) socket.write("HELO test.com\r\n");

      if (response.includes("250") && !finished) {
        finished = true;
        clearTimeout(timeout);
        socket.end();
        resolve({ smtp: true, smtp_reason: "ok" });
      }

      if ((response.includes("550") || response.includes("554")) && !finished) {
        finished = true;
        clearTimeout(timeout);
        socket.end();
        resolve({ smtp: false, smtp_reason: "server rejected" });
      }
    });

    socket.on("error", () => {
      if (!finished) {
        finished = true;
        clearTimeout(timeout);
        resolve({ smtp: false, smtp_reason: "connection failed" });
      }
    });
  });
}

// ---------------------------------------------------------
// MAIN VERIFIER
async function verifyEmail(email, checkSMTP = false) {
  const domain = email.split("@")[1]?.toLowerCase();

  // 1️⃣ Syntax
  if (!checkSyntax(email)) {
    return {
      email,
      status: false,
      reason: "syntax",
      smtp: false,
      smtp_reason: "skipped"
    };
  }

  // 2️⃣ Disposable Domain
  if (await isDisposable(email)) {
    return {
      email,
      status: false,
      reason: "disposable domain",
      smtp: false,
      smtp_reason: "skipped"
    };
  }

  // 3️⃣ DNS
  const dnsOk = await checkDNS(domain);
  if (!dnsOk) {
    return {
      email,
      status: false,
      reason: "dns",
      smtp: false,
      smtp_reason: "skipped"
    };
  }

  // 4️⃣ MX
  const mxRecords = await checkMX(domain);
  if (!mxRecords.length) {
    return {
      email,
      status: false,
      reason: "mx records",
      smtp: false,
      smtp_reason: "skipped"
    };
  }

  // 5️⃣ Catch-All (internal only)
  const catchAll = await detectCatchAll(domain);

  // Optional SMTP check
  let smtpResult = { smtp: false, smtp_reason: "skipped" };
  if (checkSMTP) {
    const bestMX = mxRecords.sort((a, b) => a.priority - b.priority)[0];
    smtpResult = await smtpCheck(bestMX);
  }

  // Return final unified object
  return {
    email,
    status: true,
    reason: "valid",
    smtp: smtpResult.smtp,
    smtp_reason: smtpResult.smtp_reason
  };
}

// ---------------------------------------------------------
// BULK VERIFY
async function bulkVerify(list, checkSMTP = false) {
  const results = [];
  for (const email of list) {
    results.push(await verifyEmail(email, checkSMTP));
  }
  return results;
}

module.exports = { verifyEmail, bulkVerify };
