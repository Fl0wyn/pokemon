import { Request, Response } from "express";
import { USER_RANK, User } from "../../models/User";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export async function postUserCreate(req: Request, res: Response, _next: unknown) {
  try {
    const actorEmail = (req.user as string)?.toLowerCase().trim();
    if (!actorEmail) {
      res.status(401).json({ error: "Non authentifié." });
      return;
    }

    const actor = await User.findOne({ email: actorEmail }).exec();
    if (!actor) {
      res.status(404).json({ error: "Utilisateur introuvable." });
      return;
    }

    if ((actor.rank ?? USER_RANK.USER) !== USER_RANK.ADMIN) {
      res.status(403).json({ error: "Seuls les administrateurs peuvent créer un utilisateur." });
      return;
    }

    const raw = (req.body as { email?: unknown })?.email;
    const email =
      typeof raw === "string" ? raw.toLowerCase().replace(/\s+/g, "").trim() : "";
    if (!email) {
      res.status(400).json({ error: "L’adresse e-mail est requise." });
      return;
    }
    if (!EMAIL_RE.test(email)) {
      res.status(400).json({ error: "Adresse e-mail invalide." });
      return;
    }

    const existing = await User.findOne({ email }).exec();
    if (existing) {
      res.status(409).json({ error: "Un utilisateur avec cet e-mail existe déjà." });
      return;
    }

    const created = await User.create({
      email,
      github: "",
      rank: USER_RANK.USER,
    });

    res.status(201).json({
      user: {
        id: created._id.toString(),
        email: String(created.email),
        github: "",
        rank: created.rank,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(e);
    res.status(400).json({ error: message });
  }
}
