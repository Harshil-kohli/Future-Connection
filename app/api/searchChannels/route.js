import mongoose from "mongoose";
import { NextResponse } from "next/server";
import Channel from "@/models/Channel";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!mongoose.connection.readyState) {
  await mongoose.connect(process.env.MONGODB_URI)
}

    // get search text
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query) {
      return NextResponse.json({ channels: [] }, { status: 200 });
    }

    const channels = await Channel.find({
      name: { $regex: query, $options: "i" }, // case-insensitive search
      visibility: "public", // Only show public channels
      userId: { $ne: session.user.id }, // Exclude channels created by current user
    })
      .select("_id name description visibility userId") // send only needed fields
      .limit(20);

    return NextResponse.json({ channels }, { status: 200 });
  } catch (error) {
    console.error("Error fetching channels:", error);
    return NextResponse.json(
      { error: "Failed to fetch channels." },
      { status: 500 }
    );
  }
}