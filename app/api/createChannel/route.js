import mongoose from "mongoose";
import Channel from "@/models/Channel";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { NextResponse } from "next/server";

export async function POST(req) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { name, description, visibility } = await req.json()
        
        if (!name || !name.trim()) {
            return NextResponse.json({ error: "Channel name is required" }, { status: 400 })
        }

        // Convert spaces to hyphens and clean up the name
        const cleanedName = name
            .trim()
            .replace(/\s+/g, '-')  // Replace spaces with hyphens
            .replace(/[^\w-]/g, '') // Remove special characters except hyphens and underscores

        if (!cleanedName) {
            return NextResponse.json({ 
                error: "Channel name must contain at least one alphanumeric character" 
            }, { status: 400 })
        }

        if (!mongoose.connection.readyState) {
  await mongoose.connect(process.env.MONGODB_URI)
}

        // Check if channel already exists (case-insensitive)
        const existingChannel = await Channel.findOne({ 
            name: { $regex: new RegExp(`^${cleanedName}$`, 'i') }
        })
        if (existingChannel) {
            return NextResponse.json({ 
                error: "Channel name already exists. Please choose a different name." 
            }, { status: 400 })
        }

        const newChannel = await Channel.create({
            userId: session.user.id,
            name: cleanedName,
            description: description || "No description added.",
            visibility: visibility || "public"
        })

        return NextResponse.json({ 
            success: true,
            message: "Channel successfully created",
            channel: newChannel
        }, { status: 201 })

    } catch (error) {
        console.error("CREATE CHANNEL ERROR:", error)
        
        // Handle duplicate key error
        if (error.code === 11000) {
            return NextResponse.json({ 
                error: "Channel name already exists. Please choose a different name." 
            }, { status: 400 })
        }

        return NextResponse.json({ 
            error: "Internal server error. Please try again." 
        }, { status: 500 })
    }
}
