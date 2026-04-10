import { Request, Response } from "express";
import { getRawSandboxConfig } from "../../services/sandboxService/rooms";

export async function getSandboxConfig(req: Request, res: Response) {
  try {
    const config = getRawSandboxConfig();
    res.status(200).json(config);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
