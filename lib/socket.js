import { Server } from 'socket.io'

let io

export const initSocket = (server) => {
  if (!io) {
    io = new Server(server, {
      path: '/api/socket',
      addTrailingSlash: false,
      cors: {
        origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
        methods: ['GET', 'POST']
      }
    })

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id)

      // Join DM room
      socket.on('join-dm', (dmId) => {
        socket.join(`dm-${dmId}`)
        console.log(`Socket ${socket.id} joined dm-${dmId}`)
      })

      // Leave DM room
      socket.on('leave-dm', (dmId) => {
        socket.leave(`dm-${dmId}`)
        console.log(`Socket ${socket.id} left dm-${dmId}`)
      })

      // Broadcast new message to room
      socket.on('send-message', ({ dmId, message }) => {
        socket.to(`dm-${dmId}`).emit('new-message', message)
      })

      // Handle typing indicator
      socket.on('typing', ({ dmId, userName }) => {
        socket.to(`dm-${dmId}`).emit('user-typing', { userName })
      })

      socket.on('stop-typing', ({ dmId }) => {
        socket.to(`dm-${dmId}`).emit('user-stop-typing')
      })

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id)
      })
    })
  }

  return io
}

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized')
  }
  return io
}
