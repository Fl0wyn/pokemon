import { Request, Response } from "express";
import mongoose from "mongoose";
import { USER_RANK, type UserRank, User } from "../../models/User";

function isUserRank(v: unknown): v is UserRank {
  return v === USER_RANK.USER || v === USER_RANK.ADMIN;
}

export async function patchUserById(req: Request, res: Response, _next: unknown) {
  try {
    const actorEmail = (req.user as string)?.toLowerCase().trim();
    if (!actorEmail) {
      res.status(401).json({ error: "Non authentifié." });
      return;
    }

    const raw = req.params.id;
    const id = Array.isArray(raw) ? raw[0] : raw;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Identifiant invalide." });
      return;
    }

    const actor = await User.findOne({ email: actorEmail }).exec();
    const target = await User.findById(id).exec();
    if (!actor || !target) {
      res.status(404).json({ error: "Utilisateur introuvable." });
      return;
    }

    const isSelf = target._id.equals(actor._id);
    const actorIsAdmin = (actor.rank ?? USER_RANK.USER) === USER_RANK.ADMIN;

    const body = req.body as { github?: unknown; rank?: unknown };
    let changed = false;

    if (body.github !== undefined) {
      if (!actorIsAdmin && !isSelf) {
        res.status(403).json({ error: "Vous ne pouvez pas modifier le profil GitHub de cet utilisateur." });
        return;
      }
      if (typeof body.github !== "string") {
        res.status(400).json({ error: "« github » doit être une chaîne." });
        return;
      }
      target.github = body.github.trim();
      changed = true;
    }

    if (body.rank !== undefined) {
      if (!actorIsAdmin) {
        res.status(403).json({ error: "Seuls les administrateurs peuvent modifier le rang." });
        return;
      }
      if (!isUserRank(body.rank)) {
        res.status(400).json({ error: "« rank » doit être « user » ou « admin »." });
        return;
      }
      target.rank = body.rank;
      changed = true;
    }

    if (!changed) {
      res.status(400).json({ error: "Aucun champ valide à mettre à jour." });
      return;
    }

    await target.save();

    res.status(200).json({
      user: {
        id: target._id.toString(),
        email: String(target.email),
        github: String(target.github ?? ""),
        rank: target.rank,
        createdAt: target.createdAt.toISOString(),
        updatedAt: target.updatedAt.toISOString(),
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(e);
    res.status(400).json({ error: message });
  }
}
