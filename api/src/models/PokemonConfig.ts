import mongoose from "mongoose";

/**
 * Stores the pokemon map configuration (rooms, desks, stairs).
 * A single document with key "main" holds the active config.
 */
export type PokemonConfigDocument = mongoose.Document & {
  key: string;
  version: number;
  defaultRoomId: string;
  rooms: Record<string, unknown>;
  updatedAt: Date;
  createdAt: Date;
};

const schema = new mongoose.Schema<PokemonConfigDocument>(
  {
    key: { type: String, required: true, unique: true, default: "main" },
    version: { type: Number, required: true, default: 1 },
    defaultRoomId: { type: String, required: true },
    rooms: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

export const PokemonConfig = mongoose.model<PokemonConfigDocument>(
  "PokemonConfig",
  schema,
);
