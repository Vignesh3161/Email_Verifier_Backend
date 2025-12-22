const dns = require("dns").promises;
const https = require("https");
const validator = require("validator");

let disposableSet = null;

// ------------------ Disposable Domains ------------------
async function fetchDisposableSet() {
  if (disposableSet) return disposableSet;

  return new Promise((resolve) => {
    https.get(
      "https://disposable.github.io/disposable-email-domains/domains.txt",
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          disposableSet = new Set(
            data
              .split(/\r?\n/)
              .map((d) => d.trim().toLowerCase())
              .filter(Boolean)
          );
          resolve(disposableSet);
        });
      }
    ).on("error", () => {
      disposableSet = new Set();
      resolve(disposableSet);
    });
  });
}

// ------------------ Checks ------------------
function checkSyntax(email) {
  return validator.isEmail(email);
}

async function isDisposable(email) {
  const domain = email.split("@")[1];
  const set = await fetchDisposableSet();
  return set.has(domain);
}

async function checkDNS(domain) {
  try {
    await dns.resolve(domain);
    return true;
  } catch {
    return false;
  }
}

async function checkMX(domain) {
  try {
    const mx = await dns.resolveMx(domain);
    return mx.length > 0;
  } catch {
    return false;
  }
}

// ------------------ Verify One Email ------------------
async function verifyEmail(email) {
  const domain = email.split("@")[1];

  if (!checkSyntax(email))
    return { email, status: false, reason: "syntax" };

  if (await isDisposable(email))
    return { email, status: false, reason: "disposable" };

  if (!(await checkDNS(domain)))
    return { email, status: false, reason: "dns" };

  if (!(await checkMX(domain)))
    return { email, status: false, reason: "mx" };

  return { email, status: true, reason: "valid" };
}

module.exports = { verifyEmail };
