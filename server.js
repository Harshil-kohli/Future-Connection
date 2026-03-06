const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')

// Validate environment variables before starting
require('./lib/validateEnv.js')

const dev = process.env.NODE_ENV !== 'production'
const hostname = dev ? 'localhost' : '0.0.0.0'
const port = process.env.PORT || 3000

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // CORS configuration - secure for production
  const allowedOrigins = dev 
    ? ['http://localhost:3000', 'http://127.0.0.1:3000']
    : [process.env.NEXT_PUBLIC_URL, process.env.NEXTAUTH_URL].filter(Boolean)

  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true)
        
        if (allowedOrigins.includes(origin)) {
          callback(null, true)
        } else {
          callback(new Error('Not allowed by CORS'))
        }
      },
      methods: ['GET', 'POST'],
      credentials: true
    }
  })

  io.on('connection', (socket) => {
    // Only log in development
    if (dev) console.log('Client connected:', socket.id)

    // Join DM room
    socket.on('join-dm', (dmId) => {
      socket.join(`dm-${dmId}`)
    })

    // Leave DM room
    socket.on('leave-dm', (dmId) => {
      socket.leave(`dm-${dmId}`)
    })

    // Join Channel room
    socket.on('join-channel', (channelId) => {
      socket.join(`channel-${channelId}`)
    })

    // Leave Channel room
    socket.on('leave-channel', (channelId) => {
      socket.leave(`channel-${channelId}`)
    })

    // Broadcast new message to DM room
    socket.on('send-message', ({ dmId, message }) => {
      // Broadcast to other users (not sender)
      socket.to(`dm-${dmId}`).emit('new-message', message)
      
      // Broadcast DM update to ALL participants (including sender) for sidebar
      io.to(`dm-${dmId}`).emit('dm-update', {
        dmId,
        lastMessage: {
          content: message.content,
          senderName: message.senderId.name,
          createdAt: message.createdAt
        },
        senderId: message.senderId._id
      })
    })

    // Broadcast new message to Channel room
    socket.on('send-channel-message', ({ channelId, message }) => {
      // Broadcast to ALL users in channel (including sender for other tabs/devices)
      io.to(`channel-${channelId}`).emit('new-channel-message', message)
    })

    // Handle read receipts for DMs
    socket.on('mark-read', ({ dmId, userId }) => {
      socket.to(`dm-${dmId}`).emit('messages-read', { userId })
    })

    // Handle typing indicator for DMs
    socket.on('typing', ({ dmId, userName }) => {
      socket.to(`dm-${dmId}`).emit('user-typing', { userName })
    })

    socket.on('stop-typing', ({ dmId }) => {
      socket.to(`dm-${dmId}`).emit('user-stop-typing')
    })

    // Handle typing indicator for Channels
    socket.on('channel-typing', ({ channelId, userName }) => {
      socket.to(`channel-${channelId}`).emit('channel-user-typing', { userName })
    })

    socket.on('channel-stop-typing', ({ channelId }) => {
      socket.to(`channel-${channelId}`).emit('channel-user-stop-typing')
    })

    socket.on('disconnect', () => {
      if (dev) console.log('Client disconnected:', socket.id)
    })
  })

  server
    .once('error', (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
      console.log(`> Socket.IO server running`)
    })
})
