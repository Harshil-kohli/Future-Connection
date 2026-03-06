import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  dmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DirectMessage",
  },
  channelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Channel",
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  content: {
    type: String,
    required: true,
    trim: true,
  },
  // File attachment support
  fileUrl: {
    type: String,
    default: null,
  },
  fileName: {
    type: String,
    default: null,
  },
  fileType: {
    type: String,
    enum: ['image', 'document', null],
    default: null,
  },
  fileSize: {
    type: Number,
    default: null,
  },
  mimeType: {
    type: String,
    default: null,
  },
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  }],
}, { timestamps: true });

messageSchema.index({ dmId: 1, createdAt: -1 });
messageSchema.index({ channelId: 1, createdAt: -1 });

// Delete the cached model to avoid conflicts
if (mongoose.models.Message) {
  delete mongoose.models.Message;
}

export default mongoose.model("Message", messageSchema);
