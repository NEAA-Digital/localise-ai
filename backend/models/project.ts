import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    apiKey: { type: String, required: true },
    projectKey: { type: String, required: true, unique: true },
    usage: {
      type: Number,
      default: 0,
    },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "projects" }
);

export default mongoose.model("Project", projectSchema);
