import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { getUploadsDir } from "../../utils/uploadsDir";

export async function getImage(req: Request, res: Response, _next: unknown) {
  try {
    const raw = req.params.file;
    const paramFile = Array.isArray(raw) ? raw[0] : raw;
    const safeName = path.basename(paramFile ?? "");
    if (!safeName || safeName !== paramFile) {
      res.status(400).json({ error: "Nom de fichier invalide." });
      return;
    }

    const filePath = path.join(getUploadsDir(), safeName);

    if (fs.existsSync(filePath)) {
      res.writeHead(200, {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.status(404).json({ error: "Fichier introuvable." });
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(e);
    res.status(400).json({ error: message });
  }
}
