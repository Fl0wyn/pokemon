const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(
  root,
  "src",
  "services",
  "pokemonService",
  "pokemonRooms.config.json",
);
const dest = path.join(
  root,
  "dist",
  "services",
  "pokemonService",
  "pokemonRooms.config.json",
);

if (!fs.existsSync(src)) {
  console.error("Missing:", src);
  process.exit(1);
}
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log("Copied pokemonRooms.config.json → dist");
