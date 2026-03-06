import mongoose from "mongoose";
import { NextResponse } from "next/server";
import DirectMessage from "@/models/DirectMessage";
import Message from "@/models/Message";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await mongoose.connect(process.env.MONGODB_URI);

    // Find all DMs where user is a participant
    const dms = await DirectMessage.find({
      participants: session.user.id
    })
      .populate('participants', '_id name email image')
      .sort({ lastMessageAt: -1 });

    // Format DMs to show the other participant and last message
    const formattedDMs = await Promise.all(dms.map(async (dm) => {
      const otherParticipant = dm.participants.find(
        p => p._id.toString() !== session.user.id
      );

      // Get last message
      const lastMessage = await Message.findOne({ dmId: dm._id })
        .sort({ createdAt: -1 })
        .populate('senderId', '_id name');

      // Count unread messages
      const unreadCount = await Message.countDocuments({
        dmId: dm._id,
        senderId: { $ne: session.user.id },
        readBy: { $ne: session.user.id }
      });

      return {
        _id: dm._id,
        user: otherParticipant,
        lastMessageAt: dm.lastMessageAt,
        lastMessage: lastMessage ? {
          content: lastMessage.content,
          senderId: lastMessage.senderId._id,
          senderName: lastMessage.senderId.name,
          isRead: lastMessage.readBy.includes(session.user.id),
          createdAt: lastMessage.createdAt
        } : null,
        unreadCount
      };
    }));

    return NextResponse.json({ dms: formattedDMs }, { status: 200 });
  } catch (error) {
    console.error("Error fetching DMs:", error);
    return NextResponse.json(
      { error: "Failed to fetch DMs" },
      { status: 500 }
    );
  }
}
