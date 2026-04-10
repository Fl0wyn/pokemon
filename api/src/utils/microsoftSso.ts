import { randomBytes } from "crypto";
import axios from "axios";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "./authSession";

const STATE_PURPOSE = "microsoft-oauth";
const ALLOWED_EMAIL_SUFFIX = "@acs2i.fr";

export type MicrosoftSsoConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  /** Must match a redirect URI registered on the app (Web platform), byte-for-byte. */
  redirectUri: string;
};

export function getMicrosoftSsoConfig(): MicrosoftSsoConfig | null {
  const tenantId = (
    process.env.MICROSOFT_AUTH_TENANT_ID ||
    process.env.AZURE_TENANT_ID ||
    ""
  ).trim();
  const clientId = (
    process.env.MICROSOFT_AUTH_CLIENT_ID ||
    process.env.AZURE_CLIENT_ID ||
    ""
  ).trim();
  const clientSecret = (
    process.env.MICROSOFT_AUTH_CLIENT_SECRET ||
    process.env.AZURE_CLIENT_SECRET ||
    ""
  ).trim();
  const explicitRedirect = (process.env.MICROSOFT_AUTH_REDIRECT_URI || "")
    .trim()
    .replace(/\/$/, "");
  const frontendUrl = (process.env.TOOLBOX_FRONTEND_URL || "")
    .trim()
    .replace(/\/$/, "");

  const redirectUri =
    explicitRedirect ||
    (frontendUrl ? `${frontendUrl}/auth/callback` : "");

  if (!tenantId || !clientId || !clientSecret || !redirectUri) {
    return null;
  }

  return {
    tenantId,
    clientId,
    clientSecret,
    redirectUri,
  };
}

export function isMicrosoftSsoConfigured(): boolean {
  return getMicrosoftSsoConfig() !== null;
}

export function createOAuthStateToken(): string {
  return jwt.sign(
    {
      purpose: STATE_PURPOSE,
      jti: randomBytes(24).toString("hex"),
    },
    getJwtSecret(),
    { expiresIn: "15m" },
  );
}

export function verifyOAuthStateToken(state: string): void {
  const decoded = jwt.verify(state, getJwtSecret()) as {
    purpose?: string;
  };
  if (decoded.purpose !== STATE_PURPOSE) {
    throw new Error("Jeton d'état invalide.");
  }
}

export function buildMicrosoftAuthorizeUrl(
  cfg: MicrosoftSsoConfig,
  state: string,
): string {
  const base = `https://login.microsoftonline.com/${encodeURIComponent(cfg.tenantId)}/oauth2/v2.0/authorize`;
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: "code",
    redirect_uri: cfg.redirectUri,
    response_mode: "query",
    scope: [
      "openid",
      "profile",
      "email",
      "https://graph.microsoft.com/User.Read",
    ].join(" "),
    state,
    prompt: "select_account",
  });
  return `${base}?${params.toString()}`;
}

export async function exchangeAuthorizationCode(
  cfg: MicrosoftSsoConfig,
  code: string,
): Promise<{ access_token: string }> {
  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(cfg.tenantId)}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: cfg.redirectUri,
  });

  const resp = await axios.post(tokenUrl, body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 20000,
  });

  const data = resp.data as { access_token?: string; error?: string; error_description?: string };
  if (!data.access_token) {
    const msg =
      data.error_description || data.error || "Échec de l'échange du code OAuth.";
    throw new Error(msg);
  }
  return { access_token: data.access_token };
}

export async function fetchPrimaryEmailFromGraph(
  accessToken: string,
): Promise<string> {
  const resp = await axios.get<{
    mail?: string | null;
    userPrincipalName?: string | null;
  }>("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { $select: "mail,userPrincipalName" },
    timeout: 15000,
  });

  const mail = (resp.data.mail || "").trim();
  const upn = (resp.data.userPrincipalName || "").trim();
  const candidate = (mail || upn).toLowerCase();
  if (!candidate || !candidate.includes("@")) {
    throw new Error(
      "Impossible de déterminer l'adresse e-mail du compte Microsoft.",
    );
  }
  return candidate;
}

export function assertAcs2iEmail(email: string): void {
  if (!email.toLowerCase().endsWith(ALLOWED_EMAIL_SUFFIX)) {
    throw new Error(
      "Seuls les comptes @acs2i.fr peuvent se connecter à la toolbox.",
    );
  }
}
