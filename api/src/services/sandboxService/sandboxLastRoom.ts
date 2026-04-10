import mongoose from "mongoose";
import { User } from "../../models/User";
import { DEFAULT_SANDBOX_ROOM_ID, getSandboxRoom } from "./rooms";

export async function getResumeSandboxRoomId(userId: string): Promise<string> {
  try {
    const u = await User.findById(userId).select("lastSandboxRoomId").lean();
    const rid = u?.lastSandboxRoomId;
    if (typeof rid === "string" && rid && getSandboxRoom(rid)) return rid;
  } catch (e) {
    console.error("[sandbox] getResumeSandboxRoomId:", e);
  }
  return DEFAULT_SANDBOX_ROOM_ID;
}

export function persistLastSandboxRoomId(userId: string, roomId: string): void {
  if (!getSandboxRoom(roomId)) return;
  void User.updateOne(
    { _id: new mongoose.Types.ObjectId(userId) },
    { $set: { lastSandboxRoomId: roomId } },
  ).exec();
}
