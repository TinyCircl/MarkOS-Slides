import { fileURLToPath } from "node:url";
import { startServer } from "./server/http-app.mjs";
import { stopArtifactCleanupScheduler } from "./core/artifact-store.mjs";

export { app, startServer } from "./server/http-app.mjs";

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  const { httpServer, grpcServer } = await startServer();

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("[markos] shutting down...");

    stopArtifactCleanupScheduler();

    await Promise.all([
      new Promise((resolve) => httpServer.close(resolve)),
      new Promise((resolve) => {
        grpcServer.tryShutdown((err) => {
          if (err) console.warn("[markos] gRPC shutdown error:", err.message);
          resolve();
        });
      }),
    ]);

    console.log("[markos] shutdown complete.");
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}
