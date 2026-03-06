import mongoose from "mongoose";
import { NextResponse } from "next/server";
import DirectMessage from "@/models/DirectMessage";
import Message from "@/models/Message";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dmId = searchParams.get("id");

    if (!dmId) {
      return NextResponse.json({ error: "DM ID is required" }, { status: 400 });
    }

    await mongoose.connect(process.env.MONGODB_URI);

    // Find the DM
    const dm = await DirectMessage.findById(dmId).populate('participants', '_id name email image');

    if (!dm) {
      return NextResponse.json({ error: "DM not found" }, { status: 404 });
    }

    // Check if user is a participant
    const isParticipant = dm.participants.some(
      p => p._id.toString() === session.user.id
    );

    if (!isParticipant) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Get the other participant
    const otherParticipant = dm.participants.find(
      p => p._id.toString() !== session.user.id
    );

    // Count unread messages
    const unreadCount = await Message.countDocuments({
      dmId,
      senderId: { $ne: session.user.id },
      readBy: { $ne: session.user.id }
    });

    return NextResponse.json({ 
      dm: {
        _id: dm._id,
        user: otherParticipant,
        createdAt: dm.createdAt,
        unreadCount
      }
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching DM:", error);
    return NextResponse.json(
      { error: "Failed to fetch DM" },
      { status: 500 }
    );
  }
}
