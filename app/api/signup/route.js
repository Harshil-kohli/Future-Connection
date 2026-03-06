import mongoose from "mongoose";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import User from "@/models/User";

export async function POST(req) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    await mongoose.connect(process.env.MONGODB_URI);

    // Check if user already exists
    const existingUser = await User.findOne({ email, provider: "credentials" });
    if (existingUser) {
      return NextResponse.json(
        { error: "Account already exists with this email" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      provider: "credentials",
      emailVerified: new Date() // Mark as verified immediately
    });

    return NextResponse.json({ 
      success: true,
      message: "Account created successfully",
      user: {
        id: newUser._id.toString(),
        name: newUser.name,
        email: newUser.email
      }
    });
  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
