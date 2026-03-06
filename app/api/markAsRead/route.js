import mongoose from "mongoose";
import { NextResponse } from "next/server";
import Message from "@/models/Message";
import DirectMessage from "@/models/DirectMessage";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { dmId } = await req.json();

    if (!dmId) {
      return NextResponse.json({ error: "DM ID is required" }, { status: 400 });
    }

    await mongoose.connect(process.env.MONGODB_URI);

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

    // Mark all unread messages as read
    await Message.updateMany(
      {
        dmId,
        senderId: { $ne: session.user.id },
        readBy: { $ne: session.user.id }
      },
      {
        $addToSet: { readBy: session.user.id }
      }
    );

    return NextResponse.json({
      success: true,
      message: "Messages marked as read"
    }, { status: 200 });

  } catch (error) {
    console.error("MARK AS READ ERROR:", error);
    return NextResponse.json({
      error: "Internal server error. Please try again.",
    }, { status: 500 });
  }
}
