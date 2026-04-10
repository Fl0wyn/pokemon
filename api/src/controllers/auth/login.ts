import { Request, Response } from "express";
import { Code } from "../../models/Code";
import { findOrCreateUserByEmail, signToolboxJwt } from "../../utils/authSession";

export async function login(req: Request, res: Response, next: any) {
  try {
    console.log("Login");

    let code = req.body.code;

    let lastCode = await Code.findOne({ code }).sort({ createdAt: -1 }).exec();

    if (!lastCode) throw new Error("Ce code n'existe pas.");

    console.log((lastCode as any).createdAt);

    const userEmail = lastCode.email as string;
    await findOrCreateUserByEmail(userEmail);
    const session = signToolboxJwt(userEmail);

    res.status(200).json(session);
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ error: e.message });
  }
}
