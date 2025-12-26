const { Worker } = require("worker_threads");
const path = require("path");

const WORKERS = 6;
const workers = [];
let index = 0;

function createWorker(i) {
  const worker = new Worker(path.resolve(__dirname, "worker.js"));

  worker.on("exit", () => {
    workers[i] = createWorker(i); // auto restart
  });

  return worker;
}

for (let i = 0; i < WORKERS; i++) {
  workers[i] = createWorker(i);
}

function runWorker(chunk) {
  return new Promise((resolve, reject) => {
    const worker = workers[index++ % WORKERS];

    worker.once("message", resolve);
    worker.once("error", reject);

    worker.postMessage(chunk);
  });
}

module.exports = runWorker;
