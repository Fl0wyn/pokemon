import { Request, Response } from "express";
import mongoose from "mongoose";
import { attachProfileAvatarToUser } from "../../services/uploadedFile/attachProfileAvatar";

/**
 * JSON body: `{ "fileId": "...", "targetUserId"?: "..." }`
 * — `targetUserId` only for admins (photo d’un autre utilisateur).
 */
export async function postUserProfileImage(req: Request, res: Response, _next: unknown) {
  try {
    const userEmail = (req.user as string)?.toLowerCase().trim();
    if (!userEmail) {
      res.status(401).json({ error: "Non authentifié." });
      return;
    }

    const fileId = typeof req.body?.fileId === "string" ? req.body.fileId.trim() : "";
    if (!fileId) {
      res.status(400).json({ error: "Champ « fileId » requis." });
      return;
    }

    const rawTarget = req.body?.targetUserId;
    const targetUserId =
      typeof rawTarget === "string" && rawTarget.trim() && mongoose.Types.ObjectId.isValid(rawTarget.trim())
        ? rawTarget.trim()
        : undefined;

    const payload = await attachProfileAvatarToUser({
      actorEmail: userEmail,
      fileId,
      targetUserId,
    });

    res.status(200).json({
      profileImage: {
        fileId: payload.id,
        previewStorageKey: payload.previewStorageKey,
        previewWidth: payload.previewWidth,
        previewHeight: payload.previewHeight,
        kind: payload.kind,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    let status = 400;
    if (message === "Utilisateur introuvable." || message === "Utilisateur cible introuvable.") {
      status = 404;
    } else if (
      message.includes("ne vous appartient") ||
      message.includes("ne peut pas modifier") ||
      message.includes("ne peut pas servir")
    ) {
      status = 403;
    }
    console.error("[postUserProfileImage]", e);
    res.status(status).json({ error: message });
  }
}
