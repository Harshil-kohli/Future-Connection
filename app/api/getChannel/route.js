import mongoose from "mongoose";
import { NextResponse } from "next/server";
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
    const channelId = searchParams.get("id");

    if (!channelId) {
      return NextResponse.json({ error: "Channel ID is required" }, { status: 400 });
    }

    await mongoose.connect(process.env.MONGODB_URI);

    // Find the channel
    const channel = await Channel.findById(channelId);

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Check if user has access (is creator or member)
    const isCreator = channel.userId.toString() === session.user.id;
    const isMember = await ChannelMember.findOne({
      channelId,
      userId: session.user.id,
    });

    if (!isCreator && !isMember) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Get member count
    const memberCount = await ChannelMember.countDocuments({ channelId });

    return NextResponse.json({ 
      channel: {
        ...channel.toObject(),
        memberCount,
        isAdmin: isCreator
      }
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching channel:", error);
    return NextResponse.json(
      { error: "Failed to fetch channel" },
      { status: 500 }
    );
  }
}
