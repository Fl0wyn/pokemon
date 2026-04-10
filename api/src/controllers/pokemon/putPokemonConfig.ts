import { Request, Response } from "express";
import { savePokemonConfig } from "../../services/pokemonService/rooms";
import { pokemonService } from "../../services/pokemonService";

export async function putPokemonConfig(req: Request, res: Response) {
  try {
    const body = req.body;
    if (!body || typeof body !== "object") {
      res.status(400).json({ error: "Corps de requête invalide." });
      return;
    }
    const changedSpawns = await savePokemonConfig(body);
    pokemonService.broadcastMapReload(changedSpawns);
    res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ error: e.message });
  }
}
