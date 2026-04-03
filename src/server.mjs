import { fileURLToPath } from "node:url";
import { startServer } from "./server/http-app.mjs";

export { app, startServer } from "./server/http-app.mjs";

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  await startServer();
}
