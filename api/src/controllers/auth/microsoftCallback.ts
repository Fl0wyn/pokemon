import { Request, Response } from "express";
import {
  assertAcs2iEmail,
  exchangeAuthorizationCode,
  fetchPrimaryEmailFromGraph,
  getMicrosoftSsoConfig,
  verifyOAuthStateToken,
} from "../../utils/microsoftSso";
import { findOrCreateUserByEmail, signToolboxJwt } from "../../utils/authSession";

export async function microsoftCallback(req: Request, res: Response) {
  try {
    const code = typeof req.body?.code === "string" ? req.body.code : "";
    const state = typeof req.body?.state === "string" ? req.body.state : "";
    if (!code || !state) {
      res.status(400).json({ error: "Paramètres code ou state manquants." });
      return;
    }

    const cfg = getMicrosoftSsoConfig();
    if (!cfg) {
      res.status(503).json({ error: "Connexion Microsoft non configurée." });
      return;
    }

    verifyOAuthStateToken(state);
    const { access_token } = await exchangeAuthorizationCode(cfg, code);
    const email = await fetchPrimaryEmailFromGraph(access_token);
    assertAcs2iEmail(email);

    await findOrCreateUserByEmail(email);
    const session = signToolboxJwt(email);
    res.status(200).json(session);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[microsoftCallback]", e);
    const forbidden = message.startsWith("Seuls les comptes");
    res.status(forbidden ? 403 : 400).json({ error: message });
  }
}
