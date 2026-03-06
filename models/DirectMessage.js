import mongoose from "mongoose";

const directMessageSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  }],
  lastMessageAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

// Ensure unique DM between two users
directMessageSchema.index({ participants: 1 }, { unique: true });

export default mongoose.models.DirectMessage ||
  mongoose.model("DirectMessage", directMessageSchema);
