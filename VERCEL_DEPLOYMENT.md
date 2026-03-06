# Vercel Deployment Guide

## Important: Socket.IO Limitation

Vercel **does not support custom Node.js servers** or WebSocket connections like Socket.IO in their serverless environment. This app uses Socket.IO for real-time messaging, which requires a persistent server connection.

## Deployment Options

### Option 1: Deploy to a Platform with Custom Server Support (Recommended)

Deploy to platforms that support custom Node.js servers:

#### Railway (Easiest)
1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Add environment variables (see below)
5. Railway will automatically detect and run `npm start`

#### Render
1. Go to [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Build Command: `npm install && npm run build`
5. Start Command: `npm start`
6. Add environment variables

#### DigitalOcean App Platform
1. Go to [digitalocean.com/products/app-platform](https://www.digitalocean.com/products/app-platform)
2. Create new app from GitHub
3. Set build command: `npm install && npm run build`
4. Set run command: `npm start`
5. Add environment variables

### Option 2: Hybrid Deployment (Vercel + External Socket.IO Server)

If you want to use Vercel for the Next.js app:

1. **Deploy Next.js app to Vercel** (without Socket.IO)
2. **Deploy Socket.IO server separately** to Railway/Render/Heroku
3. **Update Socket.IO client** to connect to external server URL

This requires code modifications (see below).

## Environment Variables Required

```env
# MongoDB
MONGODB_URI=your_mongodb_connection_string

# NextAuth
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your_secret_key_here

# OAuth (Optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_ID=your_github_id
GITHUB_SECRET=your_github_secret

# Socket.IO (for hybrid deployment)
NEXT_PUBLIC_SOCKET_URL=https://your-socketio-server.com
```

## Current Build Issue on Vercel

The error occurs because:
1. Vercel expects standard Next.js build output
2. Our `npm start` script uses custom server (`node server.js`)
3. Vercel's serverless environment can't run persistent servers

## Quick Fix for Vercel (Removes Real-time Features)

If you want to deploy to Vercel immediately without real-time messaging:

1. Update `package.json` scripts:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "start:custom": "NODE_ENV=production node server.js"
  }
}
```

2. Real-time messaging will not work, but the app will deploy successfully
3. Messages will only appear after page refresh

## Recommended Solution

**Use Railway or Render** - they're free for small projects and support custom servers out of the box. The deployment process is just as easy as Vercel, and your real-time messaging will work perfectly.

### Railway Deployment Steps:
1. Push your code to GitHub
2. Go to railway.app and sign in with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Add environment variables in the "Variables" tab
6. Click "Deploy"
7. Get your public URL from the "Settings" tab

That's it! Your app with full Socket.IO support will be live.
