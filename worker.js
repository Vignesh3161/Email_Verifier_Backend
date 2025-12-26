const { parentPort } = require("worker_threads");
const bulkVerify = require("./utils/bulkVerify");

parentPort.on("message", async (emails) => {
  const results = await bulkVerify(emails);
  parentPort.postMessage(results);
});
