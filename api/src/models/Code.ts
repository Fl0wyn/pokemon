import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    code: { type: String },
    email: { type: String },
  },
  { timestamps: true },
);

export const Code = mongoose.model("Code", schema);
