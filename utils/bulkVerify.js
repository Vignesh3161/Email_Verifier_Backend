const verifyEmail = require("./verifyEmail");
const pLimit = require("p-limit");

const limit = pLimit(5); // DNS concurrency limit

async function bulkVerify(emails, batchSize = 25) {
  const results = [];

  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map((email) => limit(() => verifyEmail(email)))
    );

    results.push(...batchResults);
  }

  return results;
}

module.exports = bulkVerify;
