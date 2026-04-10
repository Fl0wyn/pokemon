import fs from "fs";
import path from "path";

export function getUploadsDir(): string {
  return path.join(process.cwd(), "uploads");
}

export function ensureUploadsDir(): void {
  const dir = getUploadsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
