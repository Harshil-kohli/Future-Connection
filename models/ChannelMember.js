import mongoose from "mongoose";

const channelMemberSchema = new mongoose.Schema({
  channelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Channel",
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  role: {
    type: String,
    default: "member", // admin | member
  },
}, { timestamps: true });

// prevent joining twice
channelMemberSchema.index(
  { channelId: 1, userId: 1 },
  { unique: true }
);

export default mongoose.models.ChannelMember ||
  mongoose.model("ChannelMember", channelMemberSchema);