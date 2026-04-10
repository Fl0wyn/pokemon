import { Request, Response } from "express";
import { isMicrosoftSsoConfigured } from "../../utils/microsoftSso";

export function microsoftStatus(_req: Request, res: Response) {
  res.status(200).json({ enabled: isMicrosoftSsoConfigured() });
}
