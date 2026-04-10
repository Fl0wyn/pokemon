import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    subject: { type: String, required: true },
    sender: { type: String, required: true },
    recipients: { type: [String], required: true },
    content: { type: String, default: "" },
    attachmentPaths: { type: [String], default: [] },
    sentSuccessfully: { type: Boolean, required: true },
    errorMessage: { type: String, default: null },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Email = mongoose.model("Email", schema);
