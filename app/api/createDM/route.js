import mongoose from "mongoose";
import { NextResponse } from "next/server";
import DirectMessage from "@/models/DirectMessage";
import User from "@/models/User";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    if (userId === session.user.id) {
      return NextResponse.json({ error: "Cannot create DM with yourself" }, { status: 400 });
    }

    await mongoose.connect(process.env.MONGODB_URI);

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Sort participants to ensure consistent ordering
    const participants = [session.user.id, userId].sort();

    // Check if DM already exists
    let dm = await DirectMessage.findOne({
      participants: { $all: participants, $size: 2 }
    }).populate('participants', '_id name email image');

    if (dm) {
      return NextResponse.json({
        success: true,
        dm,
        message: "DM already exists"
      }, { status: 200 });
    }

    // Create new DM
    dm = await DirectMessage.create({ participants });
    dm = await DirectMessage.findById(dm._id).populate('participants', '_id name email image');

    return NextResponse.json({
      success: true,
      dm,
      message: "DM created successfully"
    }, { status: 201 });

  } catch (error) {
    console.error("CREATE DM ERROR:", error);
    return NextResponse.json({
      error: "Internal server error. Please try again.",
    }, { status: 500 });
  }
}
