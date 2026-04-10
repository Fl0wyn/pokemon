import { Request, Response } from "express";
import { getRawPokemonConfig } from "../../services/pokemonService/rooms";

export async function getPokemonConfig(req: Request, res: Response) {
  try {
    const config = getRawPokemonConfig();
    res.status(200).json(config);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
