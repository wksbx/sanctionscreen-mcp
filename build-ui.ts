import { execSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import path from "node:path";

const uiDir = "src/ui";
const outBase = "dist/ui";

// Clean previous builds
try {
  rmSync(outBase, { recursive: true });
} catch {
  // doesn't exist yet
}

const entries = readdirSync(uiDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== "shared")
  .map((d) => d.name);

for (const entry of entries) {
  const input = path.join(uiDir, entry, "index.html");
  const outDir = path.join(outBase, entry);
  console.log(`Building UI: ${entry}`);
  execSync(
    `cross-env INPUT=${input} OUT_DIR=${outDir} vite build`,
    { stdio: "inherit" },
  );
}

console.log(`Built ${entries.length} UI apps`);
