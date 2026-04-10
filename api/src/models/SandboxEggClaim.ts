import mongoose from "mongoose";
import "./User";

export type SandboxEggClaimDocument = mongoose.Document & {
  userId: mongoose.Types.ObjectId;
  roomId: string;
  x: number;
  z: number;
  svg: string;
  createdAt: Date;
  updatedAt: Date;
};

const schema = new mongoose.Schema<SandboxEggClaimDocument>(
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
    svg: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

schema.index({ createdAt: -1 });

export const SandboxEggClaim = mongoose.model<SandboxEggClaimDocument>(
  "SandboxEggClaim",
  schema,
);
