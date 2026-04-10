import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { AgentToken } from "../../models/AgentToken";

function streamAgent(res: Response) {
  const filePath = path.resolve("scripts/pm2-agent/dist/agent.cjs");
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Agent not built yet" });
    return;
  }
  res.setHeader("Content-Disposition", "attachment; filename=acs2i-agent");
  res.setHeader("Content-Type", "application/octet-stream");
  fs.createReadStream(filePath).pipe(res);
}

export async function getPm2AgentDirect(req: Request, res: Response) {
  streamAgent(res);
}

export async function getPm2Agent(req: Request, res: Response) {
  const { token } = req.params;

  const record = await AgentToken.findOne({ token });
  if (!record) {
    res.status(401).json({ error: "Token invalide" });
    return;
  }
  if (record.usedAt) {
    res.status(410).json({ error: "Token déjà utilisé" });
    return;
  }

  // Consume token
  record.usedAt = new Date();
  await record.save();

  streamAgent(res);
}
