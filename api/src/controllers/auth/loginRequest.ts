import { Request, Response } from "express";
import { Code } from "../../models/Code";
import { sendMail } from "../../utils/sendMail";

export async function loginRequest(req: Request, res: Response, next: any) {
  try {
    console.log(req.body);

    let codeStr = "";

    for (let i = 0; i < 6; i++) {
      codeStr += "" + Math.floor(Math.random() * 10) + "";
    }

    let newCode = new Code({
      code: codeStr,
      email: req.body.email,
    });

    await newCode.save();

    console.log("New code for " + req.body.email + " : " + codeStr);

    // Send email
    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color:#1a1a2e;padding:32px;text-align:center;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:1px;">Acs2i Game</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 48px 32px;text-align:center;">
              <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#111827;">Votre code de connexion</p>
              <p style="margin:0 0 32px;font-size:14px;color:#6b7280;">Utilisez ce code pour vous connecter. Il expire dans 10 minutes.</p>

              <!-- Code -->
              <div style="display:inline-block;background-color:#f4f4f5;border-radius:10px;padding:20px 40px;margin-bottom:32px;">
                <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#1a1a2e;font-family:monospace;">${codeStr}</span>
              </div>

              <p style="margin:0;font-size:12px;color:#9ca3af;">Si vous n'avez pas demandé ce code, ignorez cet e-mail.</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 48px;text-align:center;border-top:1px solid #f0f0f0;">
              <p style="margin:0;font-size:11px;color:#d1d5db;">© ${new Date().getFullYear()} Acs2i — usage interne uniquement</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    sendMail(req.body.email, "Votre code de connexion Game", html);

    res.status(200).json({
      status: "ok",
    });
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ error: e.message });
  }
}
