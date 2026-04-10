import mongoose from "mongoose";
import "./User";

export type SandboxMonsterCatchDocument = mongoose.Document & {
  userId: mongoose.Types.ObjectId;
  roomId: string;
  x: number;
  z: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

const schema = new mongoose.Schema<SandboxMonsterCatchDocument>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    roomId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    x: { type: Number, required: true },
    z: { type: Number, required: true },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

schema.index({ createdAt: -1 });

export const SandboxMonsterCatch = mongoose.model<SandboxMonsterCatchDocument>(
  "SandboxMonsterCatch",
  schema,
);
