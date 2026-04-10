import { Request, Response } from "express";
import crypto from "crypto";
import { AgentToken } from "../../models/AgentToken";

export async function generateAgentToken(req: Request, res: Response) {
  const token = crypto.randomBytes(16).toString("hex");
  await AgentToken.create({ token });
  const base = process.env.API_PUBLIC_URL || "https://toolbox.acs2i.fr/api";
  res.json({ url: `${base}/data/install-${token}` });
}
