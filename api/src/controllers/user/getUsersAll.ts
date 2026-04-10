import { Request, Response } from "express";
import { User } from "../../models/User";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function getUsersAll(req: Request, res: Response, _next: unknown) {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limitRaw = parseInt(String(req.query.limit ?? String(DEFAULT_LIMIT)), 10) || DEFAULT_LIMIT;
    const limit = Math.min(MAX_LIMIT, Math.max(1, limitRaw));
    const skip = (page - 1) * limit;

    const [total, docs] = await Promise.all([
      User.countDocuments(),
      User.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("profileImageFile", "previewStorageKey")
        .select("email github rank createdAt updatedAt profileImageFile")
        .lean()
        .exec(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    const users = docs.map((u) => {
      const f = u.profileImageFile as { previewStorageKey?: string } | null | undefined;
      return {
        id: u._id.toString(),
        email: String(u.email),
        github: String(u.github ?? ""),
        rank: (u.rank as string | undefined) ?? "user",
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
        profilePreviewKey: f?.previewStorageKey ?? null,
      };
    });

    res.status(200).json({
      users,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(e);
    res.status(400).json({ error: message });
  }
}
