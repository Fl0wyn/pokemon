import { Request, Response } from "express";

export async function postUserProfileImage(req: Request, res: Response) {
  res.status(501).json({ error: "Cette fonctionnalité n'est plus disponible." });
}
