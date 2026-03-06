import mongoose from "mongoose";
import { NextResponse } from "next/server";
import Message from "@/models/Message";
import DirectMessage from "@/models/DirectMessage";
import Channel from "@/models/Channel";
import ChannelMember from "@/models/ChannelMember";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export const dynamic = 'force-dynamic'

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { dmId, channelId, content, fileUrl, fileName, fileType, fileSize, mimeType } = await req.json();

    if ((!dmId && !channelId) || !content?.trim()) {
      return NextResponse.json({ error: "DM/Channel ID and content are required" }, { status: 400 });
    }

    await mongoose.connect(process.env.MONGODB_URI);

    // Handle DM message
    if (dmId) {
      // Verify DM exists and user is a participant
      const dm = await DirectMessage.findById(dmId);
      if (!dm) {
        return NextResponse.json({ error: "DM not found" }, { status: 404 });
      }

      const isParticipant = dm.participants.some(
        p => p.toString() === session.user.id
      );

      if (!isParticipant) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      // Create message
      const message = await Message.create({
        dmId,
        senderId: session.user.id,
        content: content.trim(),
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileType: fileType || null,
        fileSize: fileSize || null,
        mimeType: mimeType || null,
        readBy: [session.user.id]
      });

      // Update DM lastMessageAt
      await DirectMessage.findByIdAndUpdate(dmId, {
        lastMessageAt: new Date()
      });

      // Populate sender info
      const populatedMessage = await Message.findById(message._id)
        .populate('senderId', '_id name email image');

      return NextResponse.json({
        success: true,
        message: populatedMessage
      }, { status: 201 });
    }

    // Handle Channel message
    if (channelId) {
      // Verify channel exists
      const channel = await Channel.findById(channelId);
      if (!channel) {
        return NextResponse.json({ error: "Channel not found" }, { status: 404 });
      }

      // Verify user is a member or creator
      const isCreator = channel.userId?.toString() === session.user.id;
      const isMember = await ChannelMember.findOne({
        channelId,
        userId: session.user.id
      });

      if (!isCreator && !isMember) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      // Create message
      const message = await Message.create({
        channelId,
        senderId: session.user.id,
        content: content.trim(),
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileType: fileType || null,
        fileSize: fileSize || null,
        mimeType: mimeType || null,
        readBy: [session.user.id]
      });

      // Populate sender info
      const populatedMessage = await Message.findById(message._id)
        .populate('senderId', '_id name email image');

      return NextResponse.json({
        success: true,
        message: populatedMessage
      }, { status: 201 });
    }

  } catch (error) {
    console.error("SEND MESSAGE ERROR:", error);
    return NextResponse.json({
      error: "Internal server error. Please try again.",
    }, { status: 500 });
  }
}
