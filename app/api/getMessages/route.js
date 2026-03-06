import mongoose from "mongoose";
import { NextResponse } from "next/server";
import Message from "@/models/Message";
import DirectMessage from "@/models/DirectMessage";
import Channel from "@/models/Channel";
import ChannelMember from "@/models/ChannelMember";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dmId = searchParams.get("dmId");
    const channelId = searchParams.get("channelId");
    const limit = parseInt(searchParams.get("limit")) || 30;
    const before = searchParams.get("before");

    if (!dmId && !channelId) {
      return NextResponse.json({ error: "DM ID or Channel ID is required" }, { status: 400 });
    }

    await mongoose.connect(process.env.MONGODB_URI);

    // Handle DM messages
    if (dmId) {
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

      const query = { dmId };
      if (before) {
        const beforeMessage = await Message.findById(before);
        if (beforeMessage) {
          query.createdAt = { $lt: beforeMessage.createdAt };
        }
      }

      const messages = await Message.find(query)
        .populate('senderId', '_id name email image')
        .sort({ createdAt: -1 })
        .limit(limit);

      const hasMore = messages.length === limit;

      return NextResponse.json({ 
        messages: messages.reverse(),
        hasMore 
      }, { status: 200 });
    }

    // Handle Channel messages
    if (channelId) {
      const channel = await Channel.findById(channelId);
      if (!channel) {
        return NextResponse.json({ error: "Channel not found" }, { status: 404 });
      }

      const isCreator = channel.userId?.toString() === session.user.id;
      const isMember = await ChannelMember.findOne({
        channelId,
        userId: session.user.id
      });

      if (!isCreator && !isMember) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      const query = { channelId };
      if (before) {
        const beforeMessage = await Message.findById(before);
        if (beforeMessage) {
          query.createdAt = { $lt: beforeMessage.createdAt };
        }
      }

      const messages = await Message.find(query)
        .populate('senderId', '_id name email image')
        .sort({ createdAt: -1 })
        .limit(limit);

      const hasMore = messages.length === limit;

      return NextResponse.json({ 
        messages: messages.reverse(),
        hasMore 
      }, { status: 200 });
    }

  } catch (error) {
    console.error("GET MESSAGES ERROR:", error);
    return NextResponse.json({
      error: "Internal server error. Please try again.",
    }, { status: 500 });
  }
}
