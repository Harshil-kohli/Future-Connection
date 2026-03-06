# Slack-Style Team Chat Application

A modern, real-time team chat application built with Next.js, Socket.IO, and MongoDB. Features include channels, direct messages, file sharing, emoji support, and a responsive Slack-like interface.

## ✨ Features

- 🔐 **Authentication**: Email/password and OAuth (Google, GitHub)
- 💬 **Real-time Messaging**: Instant message delivery with Socket.IO
- 📢 **Channels**: Create public/private channels, manage members
- 💌 **Direct Messages**: One-on-one conversations with read receipts
- 📎 **File Sharing**: Upload and share images and documents
- 😊 **Emoji Picker**: Express yourself with emojis
- 📱 **Responsive Design**: Works seamlessly on desktop and mobile
- 🔔 **Notifications**: Unread message badges and indicators
- ⚡ **Infinite Scroll**: WhatsApp-style message loading

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- MongoDB database (local or MongoDB Atlas)
- npm or yarn package manager

### Installation

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd my-app
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**

Create a `.env.local` file in the root directory:

```env
# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret_key_here

# OAuth (Optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_ID=your_github_id
GITHUB_SECRET=your_github_secret
```

Generate `NEXTAUTH_SECRET`:
```bash
openssl rand -base64 32
```

4. **Run the development server**
```bash
npm run dev
```

5. **Open your browser**

Navigate to [http://localhost:3000](http://localhost:3000)

## 📦 Tech Stack

- **Frontend**: Next.js 16, React 19, TailwindCSS 4
- **Backend**: Node.js, Express (custom server)
- **Database**: MongoDB with Mongoose
- **Real-time**: Socket.IO
- **Authentication**: NextAuth.js
- **File Upload**: Custom API route with local storage

## 🌐 Deployment

### ⚠️ Important: Platform Selection

This app uses **Socket.IO for real-time messaging**, which requires a persistent server connection.

**✅ Recommended Platforms (Full Support):**
- Railway (Easiest, Free tier)
- Render (Free tier)
- DigitalOcean App Platform
- Heroku

**❌ Not Compatible:**
- Vercel (doesn't support custom servers/WebSockets)

### Deploy to Railway (Recommended)

1. Push your code to GitHub
2. Go to [railway.app](https://railway.app)
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Add environment variables
6. Deploy automatically

**See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed instructions.**

## 📁 Project Structure

```
my-app/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard pages
│   ├── login/            # Login page
│   └── signup/           # Signup page
├── components/            # React components
│   ├── ChatInterface.js  # Main chat UI
│   ├── ChannelSidebar.js # Channel list sidebar
│   └── ...
├── lib/                   # Utility functions
│   ├── authOptions.js    # NextAuth configuration
│   ├── db.js             # Database connection
│   └── SocketContext.js  # Socket.IO context
├── models/               # Mongoose models
│   ├── User.js
│   ├── Channel.js
│   ├── Message.js
│   └── ...
├── public/               # Static files
├── server.js            # Custom Node.js server
└── package.json
```

## 🔧 Available Scripts

```bash
npm run dev          # Start development server with Socket.IO
npm run build        # Build for production
npm start            # Start production server (standard Next.js)
npm run start:custom # Start production server with Socket.IO
npm run lint         # Run ESLint
```

## 📖 Documentation

- [Deployment Guide](./DEPLOYMENT_GUIDE.md) - Complete deployment instructions
- [Vercel Deployment](./VERCEL_DEPLOYMENT.md) - Vercel-specific notes
- [Production Readiness](./PRODUCTION_READINESS.md) - Production checklist
- [Updates Summary](./UPDATES_SUMMARY.md) - Feature changelog

## 🐛 Troubleshooting

### Real-time messaging not working
- Ensure you're running `npm run dev` (not `next dev`)
- Check that Socket.IO server is running on port 3000
- Verify MongoDB connection is active

### Build fails on Vercel
- Vercel doesn't support custom servers
- Use Railway or Render instead
- See [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)

### Database connection issues
- Verify MongoDB URI is correct
- Check MongoDB Atlas allows connections from your IP
- Ensure database user has proper permissions

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Real-time powered by [Socket.IO](https://socket.io/)
- Styled with [TailwindCSS](https://tailwindcss.com/)
- Authentication by [NextAuth.js](https://next-auth.js.org/)

