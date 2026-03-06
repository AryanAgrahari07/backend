/**
 * INFRA: Node.js Cluster Mode
 * Uses the `cluster` module to fork one worker per CPU core.
 * This gives horizontal scaling within a single VM before needing multiple nodes.
 *
 * Usage:
 *   node src/cluster.js          — production cluster entry point
 *   node src/index.js            — single-process dev entry (unchanged)
 *
 * PM2 alternative (also works):
 *   pm2 start src/index.js -i max
 */

import cluster from "cluster";
import { cpus } from "os";
import { fileURLToPath } from "url";
import path from "path";

const numCPUs = cpus().length;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (cluster.isPrimary) {
  console.log(`[Cluster] Primary PID ${process.pid} starting ${numCPUs} workers...`);

  // Fork one worker per CPU
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Auto-restart dead workers
  cluster.on("exit", (worker, code, signal) => {
    console.error(
      `[Cluster] Worker PID ${worker.process.pid} died (code=${code}, signal=${signal}). Restarting...`
    );
    cluster.fork();
  });

  cluster.on("online", (worker) => {
    console.log(`[Cluster] Worker PID ${worker.process.pid} is online`);
  });
} else {
  // Each worker runs the normal Express app
  import("./index.js").catch((err) => {
    console.error("[Cluster] Worker failed to start:", err);
    process.exit(1);
  });
}
