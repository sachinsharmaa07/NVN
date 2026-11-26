// Named sequences, bumped atomically with $inc. _id "ticket:2026" holds the last ticket number of 2026.
import mongoose from "mongoose";

const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true, match: /^[a-z]+:[0-9a-z-]+$/ },
    seq: { type: Number, required: true, min: 0 },
  },
  { versionKey: false },
);

export const Counter = mongoose.model("Counter", counterSchema);
