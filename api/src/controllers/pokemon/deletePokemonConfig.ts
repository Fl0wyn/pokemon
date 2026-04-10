import { Request, Response } from "express";
import { resetPokemonConfig } from "../../services/pokemonService/rooms";
import { pokemonService } from "../../services/pokemonService";

export async function deletePokemonConfig(req: Request, res: Response) {
  try {
    const changedSpawns = await resetPokemonConfig();
    pokemonService.broadcastMapReload(changedSpawns);
    res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
