import axios from "axios";
import { Email } from "../models/Email";

async function getMicrosoftAccessTokenWithClientCredentials(params: {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ accessToken: string; expiresIn: number }> {
  const { tenantId, clientId, clientSecret } = params;
  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default",
  });

  try {
    const resp = await axios.post(tokenUrl, body.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 15000,
    });

    const data = resp.data as { access_token: string; expires_in: number };
    if (!data?.access_token) {
      throw new Error("Failed to obtain Microsoft access token");
    }
    return { accessToken: data.access_token, expiresIn: data.expires_in };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const errorData = error.response.data as any;
      const errorMsg =
        errorData?.error_description || errorData?.error || "Unknown error";
      console.error(
        "Token request failed:",
        JSON.stringify(errorData, null, 2),
      );
      throw new Error(`Failed to obtain access token: ${errorMsg}`);
    }
    throw error;
  }
}

interface EmailRecipient {
  emailAddress: {
    address: string;
    name?: string;
  };
}

interface EmailMessage {
  subject: string;
  body: {
    contentType: "Text" | "HTML";
    content: string;
  };
  toRecipients: EmailRecipient[];
  ccRecipients?: EmailRecipient[];
  bccRecipients?: EmailRecipient[];
}

async function sendEmailViaGraphAPI(params: {
  accessToken: string;
  fromEmail: string;
  message: EmailMessage;
  saveToSentItems?: boolean;
}): Promise<void> {
  const { accessToken, fromEmail, message, saveToSentItems = true } = params;

  const graphUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(fromEmail)}/sendMail`;

  const payload = {
    message,
    saveToSentItems,
  };

  try {
    await axios.post(graphUrl, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const errorData = error.response.data as any;
      const errorMsg =
        errorData?.error?.message || errorData?.error || "Unknown error";
      console.error(
        "Graph API request failed:",
        JSON.stringify(errorData, null, 2),
      );
      throw new Error(`Failed to send email via Graph API: ${errorMsg}`);
    }
    throw error;
  }
}

export async function sendMail(
  email: string,
  subject: string,
  text: string,
  sentByUserId?: string | null,
) {
  const toAddresses = email.split(",").map((addr) => addr.trim());
  const fromEmail = process.env.SMTP_USER ?? "unknown";

  try {
    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;

    if (!tenantId || !clientId || !clientSecret || !process.env.SMTP_USER) {
      throw new Error(
        "OAuth2.0 configuration missing. Please set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, and SMTP_USER environment variables.",
      );
    }

    console.log("Obtaining Microsoft access token...");
    const { accessToken } = await getMicrosoftAccessTokenWithClientCredentials({
      tenantId,
      clientId,
      clientSecret,
    });
    console.log("Access token obtained successfully");

    if (process.env.DEBUG_TOKEN === "true") {
      try {
        const tokenParts = accessToken.split(".");
        const payload = JSON.parse(
          Buffer.from(tokenParts[1], "base64").toString(),
        );
        console.log("\n Token Debug Info:");
        console.log("  - App ID:", payload.appid || payload.azp);
        console.log("  - Roles (Permissions):", payload.roles || "(none)");
        console.log("  - Expires:", new Date(payload.exp * 1000).toISOString());
        console.log("");
      } catch (e) {
        console.log("Could not decode token for debugging");
      }
    }

    const message: EmailMessage = {
      subject,
      body: { contentType: "HTML", content: text },
      toRecipients: toAddresses.map((addr) => ({
        emailAddress: { address: addr },
      })),
    };

    const saveToSentItems = process.env.SAVE_TO_SENT_ITEMS !== "false";

    console.log(`Sending email from ${fromEmail} to ${toAddresses.join(", ")}...`);
    await sendEmailViaGraphAPI({ accessToken, fromEmail, message, saveToSentItems });
    console.log("Email sent successfully via Microsoft Graph API!");

    await Email.create({
      subject,
      sender: fromEmail,
      recipients: toAddresses,
      content: text,
      attachmentPaths: [],
      sentSuccessfully: true,
      errorMessage: null,
      sentBy: sentByUserId ?? null,
      sentAt: new Date(),
    });
  } catch (error: any) {
    console.error("Error sending email:", error?.message || error);

    await Email.create({
      subject,
      sender: fromEmail,
      recipients: toAddresses,
      content: text,
      attachmentPaths: [],
      sentSuccessfully: false,
      errorMessage: error?.message ?? String(error),
      sentBy: sentByUserId ?? null,
      sentAt: new Date(),
    }).catch(() => {});

    throw error;
  }
}
