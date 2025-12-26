const dns = require("dns").promises;
const https = require("https");
const validator = require("validator");

let disposableSet = null;
const dnsCache = new Map();

const CACHE_TTL = 30 * 60 * 1000; // 30 min
const MAX_CACHE = 50000;

// ---------- timeout helper ----------
function withTimeout(promise, ms = 3000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("DNS timeout")), ms)
    ),
  ]);
}

// ---------- disposable domains ----------
async function loadDisposableDomains() {
  if (disposableSet) return disposableSet;

  return new Promise((resolve) => {
    https
      .get(
        "https://disposable.github.io/disposable-email-domains/domains.txt",
        { timeout: 5000 },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
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
      )
      .on("error", () => resolve(new Set()));
  });
}

// ---------- DNS + MX ----------
async function checkDNSMX(domain) {
  const cached = dnsCache.get(domain);
  if (cached && cached.expires > Date.now()) return cached;

  let dnsOk = false;
  let mxOk = false;

  try {
    await withTimeout(dns.resolve(domain));
    dnsOk = true;
  } catch {}

  try {
    const mx = await withTimeout(dns.resolveMx(domain));
    mxOk = mx.length > 0;
  } catch {}

  const record = {
    dns: dnsOk,
    mx: mxOk,
    expires: Date.now() + CACHE_TTL,
  };

  dnsCache.set(domain, record);

  if (dnsCache.size > MAX_CACHE) dnsCache.clear();

  return record;
}

// ---------- verify one ----------
async function verifyEmail(email) {
  email = email.trim();

  if (!validator.isEmail(email))
    return { email, status: false, reason: "syntax" };

  const domain = email.split("@")[1].toLowerCase();

  const disposable = await loadDisposableDomains();
  if (disposable.has(domain))
    return { email, status: false, reason: "disposable" };

  const { dns, mx } = await checkDNSMX(domain);

  if (!dns) return { email, status: false, reason: "dns" };
  if (!mx) return { email, status: false, reason: "mx" };

  return { email, status: true, reason: "valid" };
}

module.exports = verifyEmail;
