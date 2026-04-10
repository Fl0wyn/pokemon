import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");
const bundlePath = path.join(dist, "agent.cjs");
const seaConfigPath = path.join(root, "sea-config.json");

if (!fs.existsSync(bundlePath)) {
  console.error("Run 'npm run build' first to create dist/agent.cjs");
  process.exit(1);
}

const isWindows = process.platform === "win32";
const outputName = isWindows ? "agent.exe" : "agent";
const outputPath = path.join(dist, outputName);

const seaConfig = {
  main: bundlePath,
  mainFormat: "commonjs",
  output: outputPath,
  disableExperimentalSEAWarning: true,
};

fs.writeFileSync(seaConfigPath, JSON.stringify(seaConfig, null, 2));

try {
  execSync(`node --build-sea "${seaConfigPath}"`, {
    stdio: "inherit",
    cwd: root,
  });
  console.log("SEA executable written to", outputPath);
} catch (err) {
  console.error("SEA build failed. Ensure Node.js >= 25.5.0 for --build-sea.");
  console.error(
    "See https://nodejs.org/api/single-executable-applications.html",
  );
  process.exit(1);
}
