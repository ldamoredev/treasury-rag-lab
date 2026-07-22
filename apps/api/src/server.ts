import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import { createProductionApp } from "./composition/createProductionApp.js";

try {
  loadEnvFile(fileURLToPath(new URL("../../../.env", import.meta.url)));
} catch (error) {
  const code = error instanceof Error && "code" in error
    ? (error as Error & { code?: string }).code
    : undefined;

  if (code !== "ENOENT") {
    throw error;
  }
}

const port = Number.parseInt(process.env.PORT ?? "4000", 10);
const app = createProductionApp();

app.listen(port, () => {
  console.log(`Treasury RAG API listening on http://localhost:${port}`);
});
