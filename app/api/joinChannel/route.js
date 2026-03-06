import mongoose from "mongoose";
import { NextResponse } from "next/server";
import ChannelMember from "@/models/ChannelMember";
import Channel from "@/models/Channel";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function POST(req) {
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

    // Check if channel exists
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Check if user is already a member
    const existingMember = await ChannelMember.findOne({
      channelId,
      userId: session.user.id,
    });

    if (existingMember) {
      return NextResponse.json({ error: "You are already a member of this channel" }, { status: 400 });
    }

    // Add user as member
    const newMember = await ChannelMember.create({
      channelId,
      userId: session.user.id,
      role: "member",
    });

    return NextResponse.json({
      success: true,
      message: "Successfully joined channel",
      member: newMember,
      channel,
    }, { status: 201 });

  } catch (error) {
    console.error("JOIN CHANNEL ERROR:", error);

    // Handle duplicate key error
    if (error.code === 11000) {
      return NextResponse.json({
        error: "You are already a member of this channel",
      }, { status: 400 });
    }

    return NextResponse.json({
      error: "Internal server error. Please try again.",
    }, { status: 500 });
  }
}
