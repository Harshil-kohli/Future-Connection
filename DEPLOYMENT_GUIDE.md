# Complete Deployment Guide

## ⚠️ Important: Choose the Right Platform

This application uses **Socket.IO for real-time messaging**, which requires a persistent server connection. 

**Note:** This app uses Next.js 16 with the new `proxy.js` convention (previously `middleware.js`).

### Platforms Comparison:

| Platform | Socket.IO Support | Difficulty | Cost |
|----------|------------------|------------|------|
| **Railway** ✅ | Full Support | Easy | Free tier available |
| **Render** ✅ | Full Support | Easy | Free tier available |
| **DigitalOcean** ✅ | Full Support | Medium | Starts at $5/month |
| **Heroku** ✅ | Full Support | Easy | Paid only |
| **Vercel** ❌ | Not Supported | N/A | Free tier available |

## Recommended: Deploy to Railway (Easiest & Free)

### Step 1: Prepare Your Repository

1. Make sure your code is pushed to GitHub
2. Ensure all environment variables are documented

### Step 2: Deploy to Railway

1. Go to [railway.app](https://railway.app)
2. Click **"Login"** and sign in with GitHub
3. Click **"New Project"**
4. Select **"Deploy from GitHub repo"**
5. Choose your repository
6. Railway will automatically detect your app

### Step 3: Add Environment Variables

Click on your project → **"Variables"** tab → Add these:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname
NEXTAUTH_URL=https://your-app.railway.app
NEXTAUTH_SECRET=generate_a_random_secret_key_here
GOOGLE_CLIENT_ID=your_google_client_id (optional)
GOOGLE_CLIENT_SECRET=your_google_client_secret (optional)
GITHUB_ID=your_github_id (optional)
GITHUB_SECRET=your_github_secret (optional)
NODE_ENV=production
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### Step 4: Deploy

1. Railway will automatically build and deploy
2. Get your public URL from **"Settings"** → **"Public Networking"** → **"Generate Domain"**
3. Update `NEXTAUTH_URL` with your Railway domain
4. Redeploy if needed

### Step 5: Update OAuth Callbacks (if using Google/GitHub)

Update your OAuth app settings with the new callback URL:
- Google: `https://your-app.railway.app/api/auth/callback/google`
- GitHub: `https://your-app.railway.app/api/auth/callback/github`

---

## Alternative: Deploy to Render

### Step 1: Create Account

1. Go to [render.com](https://render.com)
2. Sign up with GitHub

### Step 2: Create New Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure:
   - **Name:** your-app-name
   - **Environment:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start:custom`
   - **Plan:** Free

### Step 3: Add Environment Variables

In the "Environment" section, add all variables listed above.

### Step 4: Deploy

Click **"Create Web Service"** and wait for deployment.

---

## Alternative: Deploy to DigitalOcean App Platform

### Step 1: Create App

1. Go to [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
2. Click **"Create App"**
3. Connect GitHub and select repository

### Step 2: Configure

- **Build Command:** `npm install && npm run build`
- **Run Command:** `npm run start:custom`
- **HTTP Port:** 3000

### Step 3: Add Environment Variables

Add all required environment variables in the app settings.

### Step 4: Deploy

Click **"Create Resources"** and deploy.

---

## Vercel Deployment (Limited - No Real-time Features)

If you must use Vercel, real-time messaging **will not work**. Messages will only appear after page refresh.

### Steps:

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add environment variables
5. Deploy

**Note:** The `npm start` script has been updated to use standard Next.js server for Vercel compatibility. Use `npm run start:custom` for local development with Socket.IO.

---

## Local Development

### With Socket.IO (Real-time):
```bash
npm run dev
```

### Without Socket.IO (Standard Next.js):
```bash
npm run build
npm start
```

---

## Environment Variables Explained

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGODB_URI` | MongoDB connection string | Yes |
| `NEXTAUTH_URL` | Your app's public URL | Yes |
| `NEXTAUTH_SECRET` | Random secret for JWT encryption | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | No |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | No |
| `GITHUB_ID` | GitHub OAuth app ID | No |
| `GITHUB_SECRET` | GitHub OAuth secret | No |
| `NODE_ENV` | Set to "production" for deployment | Yes |

---

## Troubleshooting

### Build Fails
- Check that all environment variables are set
- Ensure MongoDB URI is correct
- Check build logs for specific errors

### Socket.IO Not Working
- Verify you're using a platform that supports WebSockets
- Check that the server is running with `node server.js`
- Ensure firewall allows WebSocket connections

### OAuth Not Working
- Verify callback URLs match your deployment URL
- Check OAuth credentials are correct
- Ensure `NEXTAUTH_URL` matches your domain exactly

### Database Connection Issues
- Verify MongoDB URI is correct
- Check MongoDB Atlas allows connections from all IPs (0.0.0.0/0)
- Ensure database user has read/write permissions

---

## Post-Deployment Checklist

- [ ] App loads successfully
- [ ] Can sign up/login
- [ ] Can create channels
- [ ] Can send messages
- [ ] Real-time messaging works (messages appear instantly)
- [ ] File uploads work
- [ ] Emoji picker works
- [ ] Mobile responsive layout works
- [ ] OAuth login works (if configured)

---

## Need Help?

If you encounter issues:
1. Check the deployment platform's logs
2. Verify all environment variables are set correctly
3. Test locally first with `npm run dev`
4. Check MongoDB connection
5. Ensure OAuth callbacks are configured correctly

---

## Summary

**For best results:** Use Railway or Render for full Socket.IO support and real-time messaging. The deployment process is just as easy as Vercel, and your app will work exactly as intended with all real-time features functional.
