import mongoose from "mongoose";
import { NextResponse } from "next/server";
import Channel from "@/models/Channel";
import ChannelMember from "@/models/ChannelMember";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function DELETE(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { channelId } = await req.json();

    if (!channelId) {
      return NextResponse.json({ error: "Channel ID is required" }, { status: 400 });
    }

    await mongoose.connect(process.env.MONGODB_URI);

    // Find the channel
    const channel = await Channel.findById(channelId);

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Check if user is the creator (admin)
    if (channel.userId.toString() !== session.user.id) {
      return NextResponse.json({ error: "Only channel creator can delete the channel" }, { status: 403 });
    }

    // Delete all channel members
    await ChannelMember.deleteMany({ channelId });

    // Delete the channel
    await Channel.findByIdAndDelete(channelId);

    return NextResponse.json({
      success: true,
      message: "Channel deleted successfully"
    }, { status: 200 });

  } catch (error) {
    console.error("DELETE CHANNEL ERROR:", error);
    return NextResponse.json({
      error: "Internal server error. Please try again.",
    }, { status: 500 });
  }
}
