import mongoose from "mongoose";
import { NextResponse } from "next/server";
import ChannelMember from "@/models/ChannelMember";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await mongoose.connect(process.env.MONGODB_URI);

    // Find all channels the user is a member of
    const memberships = await ChannelMember.find({ userId: session.user.id })
      .populate("channelId", "name description visibility")
      .sort({ createdAt: -1 });

    // Extract channel data
    const channels = memberships
      .filter(m => m.channelId) // Filter out null channels
      .map(m => m.channelId);

    return NextResponse.json({ channels }, { status: 200 });
  } catch (error) {
    console.error("Error fetching joined channels:", error);
    return NextResponse.json(
      { error: "Failed to fetch joined channels" },
      { status: 500 }
    );
  }
}
