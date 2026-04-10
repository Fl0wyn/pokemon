import mongoose from "mongoose";
import "./User";

/**
 * Last known sandbox position per user per room (persisted).
 * Together, documents for a user form the logical "array" of saved placements by room.
 */
export type SandboxPlacementDocument = mongoose.Document & {
  userId: mongoose.Types.ObjectId;
  roomId: string;
  x: number;
  z: number;
  previewKey: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const schema = new mongoose.Schema<SandboxPlacementDocument>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    roomId: {
      type: String,
      required: true,
      trim: true,
    },
    x: { type: Number, required: true },
    z: { type: Number, required: true },
    previewKey: { type: String, default: null },
  },
  { timestamps: true },
);

schema.index({ userId: 1, roomId: 1 }, { unique: true });

export const SandboxPlacement = mongoose.model<SandboxPlacementDocument>(
  "SandboxPlacement",
  schema,
);
