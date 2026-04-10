import { Request, Response } from "express";
import mongoose from "mongoose";
import { User } from "../../models/User";

export async function getUserById(req: Request, res: Response, _next: unknown) {
  try {
    const raw = req.params.id;
    const id = Array.isArray(raw) ? raw[0] : raw;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Identifiant invalide." });
      return;
    }

    const doc = await User.findById(id)
      .populate("profileImageFile", "previewStorageKey")
      .select("email github rank createdAt updatedAt profileImageFile")
      .lean()
      .exec();

    if (!doc) {
      res.status(404).json({ error: "Utilisateur introuvable." });
      return;
    }

    const f = doc.profileImageFile as { previewStorageKey?: string } | null | undefined;

    res.status(200).json({
      user: {
        id: doc._id.toString(),
        email: String(doc.email),
        github: String(doc.github ?? ""),
        rank: (doc.rank as "user" | "admin" | undefined) ?? "user",
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
        profilePreviewKey: f?.previewStorageKey ?? null,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(e);
    res.status(400).json({ error: message });
  }
}
