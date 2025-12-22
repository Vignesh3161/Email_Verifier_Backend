const { verifyEmail } = require("./verify");

async function bulkVerify(emails, batchSize = 20) {
  const results = [];

  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map((email) => verifyEmail(email))
    );

    results.push(...batchResults);
  }

  return results;
}

module.exports = bulkVerify;
