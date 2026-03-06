import mongoose from "mongoose";
import { NextResponse } from "next/server";
import Channel from "@/models/Channel";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) return NextResponse.json({error:"Unauthorized"},{status:401})

        if (!mongoose.connection.readyState) {
  await mongoose.connect(process.env.MONGODB_URI)
}
        const channels = await Channel.find({userId:session.user.id})
        return NextResponse.json({channels},{status:200})
    } catch (error) {
        console.log("Error fetching channels", error)
        return NextResponse.json({error: "Failed to fetch channels"},{status:500})
    }
}