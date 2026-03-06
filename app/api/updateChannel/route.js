import mongoose from "mongoose";
import { NextResponse } from "next/server";
import Channel from "@/models/Channel";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function PUT(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { channelId, name, description } = await req.json();

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
      return NextResponse.json({ error: "Only channel creator can edit the channel" }, { status: 403 });
    }

    // Update fields if provided
    if (name !== undefined) {
      // Clean and format the name
      const cleanedName = name
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '');

      if (!cleanedName) {
        return NextResponse.json({
          error: "Channel name must contain at least one alphanumeric character"
        }, { status: 400 });
      }

      // Check if new name already exists (case-insensitive, excluding current channel)
      const existingChannel = await Channel.findOne({
        _id: { $ne: channelId },
        name: { $regex: new RegExp(`^${cleanedName}$`, 'i') }
      });

      if (existingChannel) {
        return NextResponse.json({
          error: "Channel name already exists. Please choose a different name."
        }, { status: 400 });
      }

      channel.name = cleanedName;
    }

    if (description !== undefined) {
      channel.description = description.trim() || "No description added.";
    }

    await channel.save();

    return NextResponse.json({
      success: true,
      message: "Channel updated successfully",
      channel
    }, { status: 200 });

  } catch (error) {
    console.error("UPDATE CHANNEL ERROR:", error);

    if (error.code === 11000) {
      return NextResponse.json({
        error: "Channel name already exists. Please choose a different name."
      }, { status: 400 });
    }

    return NextResponse.json({
      error: "Internal server error. Please try again.",
    }, { status: 500 });
  }
}
