import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import mongoose from "mongoose";
import User from "../models/User";
import bcrypt from "bcryptjs";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_ID,
      clientSecret: process.env.GOOGLE_SECRET,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        await mongoose.connect(process.env.MONGODB_URI);
        const user = await User.findOne({ 
          email: credentials.email,
          provider: "credentials"
        }).select("+password");
        
        if (!user) return null;

        // Require password for credentials login
        if (!user.password) return null;

        // Verify password
        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) return null;

        return { 
          id: user._id.toString(), 
          email: user.email, 
          name: user.name, 
          image: null 
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 3 * 24 * 60 * 60, // 3 days in seconds
  },

  // Add debug mode to see errors
  debug: process.env.NODE_ENV === 'development',

  callbacks: {
    // ensure DB user exists for OAuth and attach id to user object
    async signIn({ user, account, profile }) {
      await mongoose.connect(process.env.MONGODB_URI);

      if (account?.provider === "google" || account?.provider === "github") {
        let currentUser = await User.findOne({ 
          email: user.email,
          provider: account.provider
        });
        
        if (!currentUser) {
          currentUser = await User.create({
            name: profile?.name || user.name,
            email: user.email,
            provider: account.provider,
            image: profile?.picture || user.image,
            password: null,
            emailVerified: new Date(),
          });
        }
        user.id = currentUser._id.toString();
      }

      // Returning true allows the sign-in to proceed for all providers
      return true;
    },

    // Persist id and login time into JWT token
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id || user._id?.toString();
        token.loginTime = Date.now();
      }
      
      // Check if session has expired (3 days)
      if (token.loginTime) {
        const now = Date.now();
        const SESSION_EXPIRE_MS = 3 * 24 * 60 * 60 * 1000;
        if (now - token.loginTime > SESSION_EXPIRE_MS) {
          // Session expired - return null to force logout
          return {};
        }
      }
      
      return token;
    },

    // Expose id on session.user.id
    async session({ session, token }) {
      // Handle invalid or expired tokens gracefully
      if (!token || !token.id) {
        return null;
      }
      
      if (!session.user) session.user = {};
      session.user.id = token.id;
      session.user.image = session.user.image || token.image;
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/signup",
    error: "/auth/error",
  },
};

