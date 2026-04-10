import mongoose from "mongoose";
import "./File";

export const USER_RANK = {
  USER: "user",
  ADMIN: "admin",
} as const;

export type UserRank = (typeof USER_RANK)[keyof typeof USER_RANK];

export type UserDocument = mongoose.Document & {
  _id: mongoose.Types.ObjectId;
  email: string;
  github: string;
  rank: UserRank;
  profileImageFile?: mongoose.Types.ObjectId | null;
  /** Last toolbox sandbox room id (for resume when returning to /sandbox). */
  lastSandboxRoomId?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const schema = new mongoose.Schema<UserDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    github: {
      type: String,
      default: "",
      trim: true,
    },
    rank: {
      type: String,
      enum: Object.values(USER_RANK),
      default: USER_RANK.USER,
    },
    profileImageFile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "File",
      default: null,
    },
    lastSandboxRoomId: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

export const User = mongoose.model<UserDocument>("User", schema);
