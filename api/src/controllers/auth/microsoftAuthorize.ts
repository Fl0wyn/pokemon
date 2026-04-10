import { Request, Response } from "express";
import {
  buildMicrosoftAuthorizeUrl,
  createOAuthStateToken,
  getMicrosoftSsoConfig,
} from "../../utils/microsoftSso";

export function microsoftAuthorize(_req: Request, res: Response) {
  try {
    const cfg = getMicrosoftSsoConfig();
    if (!cfg) {
      res.status(503).json({
        error:
          "Connexion Microsoft non configurée (variables MICROSOFT_AUTH_* et TOOLBOX_FRONTEND_URL).",
      });
      return;
    }
    const state = createOAuthStateToken();
    const url = buildMicrosoftAuthorizeUrl(cfg, state);
    if (process.env.DEBUG_SSO === "true") {
      console.log("[microsoftAuthorize] redirect_uri sent to Entra:", cfg.redirectUri);
    }
    res.status(200).json({ url });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[microsoftAuthorize]", e);
    res.status(500).json({ error: message });
  }
}
