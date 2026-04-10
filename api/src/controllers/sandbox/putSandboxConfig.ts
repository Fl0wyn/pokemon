import { Request, Response } from "express";
import { saveSandboxConfig } from "../../services/sandboxService/rooms";
import { sandboxService } from "../../services/sandboxService";

export async function putSandboxConfig(req: Request, res: Response) {
  try {
    const body = req.body;
    if (!body || typeof body !== "object") {
      res.status(400).json({ error: "Corps de requête invalide." });
      return;
    }
    const changedSpawns = await saveSandboxConfig(body);
    sandboxService.broadcastMapReload(changedSpawns);
    res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ error: e.message });
  }
}
