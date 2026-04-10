import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.join(__dirname, "..", "dist", "agent.cjs");

esbuild
  .build({
    entryPoints: [path.join(__dirname, "..", "src", "index.ts")],
    bundle: true,
    format: "cjs",
    platform: "node",
    target: "node20",
    outfile: outFile,
    sourcemap: true,
    minify: false,
    external: [],
  })
  .then(() => {
    console.log("Bundled to", outFile);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
