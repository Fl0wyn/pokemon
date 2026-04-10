import mongoose from "mongoose";
import { User } from "../../models/User";
import { DEFAULT_POKEMON_ROOM_ID, getPokemonRoom } from "./rooms";

export async function getResumePokemonRoomId(userId: string): Promise<string> {
  try {
    const u = await User.findById(userId).select("lastPokemonRoomId").lean();
    const rid = u?.lastPokemonRoomId;
    if (typeof rid === "string" && rid && getPokemonRoom(rid)) return rid;
  } catch (e) {
    console.error("[pokemon] getResumePokemonRoomId:", e);
  }
  return DEFAULT_POKEMON_ROOM_ID;
}

export function persistLastPokemonRoomId(userId: string, roomId: string): void {
  if (!getPokemonRoom(roomId)) return;
  void User.updateOne(
    { _id: new mongoose.Types.ObjectId(userId) },
    { $set: { lastPokemonRoomId: roomId } },
  ).exec();
}
