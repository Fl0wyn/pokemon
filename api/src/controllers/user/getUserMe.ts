import { Request, Response } from "express";
import { User } from "../../models/User";

export async function getUserMe(req: Request, res: Response, _next: unknown) {
  try {
    const userEmail = req.user as string;
    const user = await User.findOne({ email: userEmail })
      .populate("profileImageFile", "previewStorageKey previewWidth previewHeight kind")
      .exec();

    if (!user) {
      res.status(404).json({ error: "Utilisateur introuvable." });
      return;
    }

    const file = user.profileImageFile as
      | {
          _id: { toString: () => string };
          previewStorageKey?: string;
          previewWidth?: number;
          previewHeight?: number;
          kind?: string;
        }
      | null
      | undefined;

    res.status(200).json({
      id: user._id.toString(),
      email: user.email,
      github: String(user.github ?? ""),
      rank: user.rank ?? "user",
      profileImage: file?.previewStorageKey
        ? {
            fileId: file._id.toString(),
            previewStorageKey: file.previewStorageKey,
            previewWidth: file.previewWidth ?? 500,
            previewHeight: file.previewHeight ?? 500,
            kind: file.kind,
          }
        : null,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(e);
    res.status(400).json({ error: message });
  }
}
