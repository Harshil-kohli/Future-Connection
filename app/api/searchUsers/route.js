import mongoose from "mongoose";
import { NextResponse } from "next/server";
import User from "@/models/User";
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
      return NextResponse.json({ users: [] }, { status: 200 });
    }

    const users = await User.find({
      _id: { $ne: session.user.id }, // Exclude current user
      name: { $regex: query, $options: "i" }, // case-insensitive search
    })
      .select("_id name email image") // send only needed fields
      .limit(20);

    return NextResponse.json({ users }, { status: 200 });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users." },
      { status: 500 }
    );
  }
}