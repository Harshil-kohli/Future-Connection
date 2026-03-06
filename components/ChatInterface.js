"use client"
import { useState, useEffect, useRef } from 'react'
import { useSocket } from '@/lib/SocketContext'
import { useSession } from 'next-auth/react'
import dynamic from 'next/dynamic'

// Dynamically import emoji picker to avoid SSR issues
const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false })

const ChatInterface = ({ channelId, dmId }) => {
  const { data: session } = useSession()
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])
  const [channel, setChannel] = useState(null)
  const [dm, setDm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [sending, setSending] = useState(false)
  const [typing, setTyping] = useState(false)
  const [showUnreadBanner, setShowUnreadBanner] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState(null)
  const [showUnreadDivider, setShowUnreadDivider] = useState(false)
  const [lastReadMessageId, setLastReadMessageId] = useState(null) // Track last message when entering channel
  const [showSettingsPopup, setShowSettingsPopup] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', description: '' })
  const [editError, setEditError] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [uploading, setUploading] = useState(false)
  const settingsTimeoutRef = useRef(null)
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const fileInputRef = useRef(null)
  const { socket, isConnected } = useSocket()

  useEffect(() => {
    if (!channelId && !dmId) {
      setLoading(false)
      setChannel(null)
      setDm(null)
      setMessages([])
      return
    }

    const fetchData = async () => {
      setLoading(true)
      setChannel(null)
      setDm(null)
      setMessages([])
      setHasMore(true)
      setMessage('') // Clear message input when switching channels/DMs

      try {
        if (channelId) {
          // Clear the unread count for this channel in sidebar
          if (window.clearChannelUnread) {
            window.clearChannelUnread(channelId)
          }
          
          const [channelRes, messagesRes] = await Promise.all([
            fetch(`/api/getChannel?id=${channelId}`),
            fetch(`/api/getMessages?channelId=${channelId}&limit=30`)
          ])
          
          const channelData = await channelRes.json()
          const messagesData = await messagesRes.json()
          
          if (channelRes.ok) {
            setChannel(channelData.channel)
          }
          
          if (messagesRes.ok) {
            setMessages(messagesData.messages || [])
            setHasMore(messagesData.hasMore || false)
            
            // For channels, mark the last message as "read" when entering
            if (messagesData.messages && messagesData.messages.length > 0) {
              const lastMsg = messagesData.messages[messagesData.messages.length - 1]
              setLastReadMessageId(lastMsg._id)
            }
            
            // Don't show unread divider initially for channels
            setFirstUnreadMessageId(null)
            setShowUnreadDivider(false)
          }
        } else if (dmId) {
          const [dmRes, messagesRes] = await Promise.all([
            fetch(`/api/getDM?id=${dmId}`),
            fetch(`/api/getMessages?dmId=${dmId}&limit=30`)
          ])
          
          const dmData = await dmRes.json()
          const messagesData = await messagesRes.json()
          
          if (dmRes.ok) {
            setDm(dmData.dm)
            
            // Show unread banner if there are unread messages
            const unreadFromAPI = dmData.dm.unreadCount || 0
            if (unreadFromAPI > 0) {
              setUnreadCount(unreadFromAPI)
              setShowUnreadBanner(true)
              setTimeout(() => setShowUnreadBanner(false), 2000)
              
              // Find first unread message for divider (only for DMs)
              if (messagesData.messages && messagesData.messages.length > 0 && session?.user?.email) {
                // Count unread messages and find first unread
                let unreadMessages = []
                for (let i = 0; i < messagesData.messages.length; i++) {
                  const msg = messagesData.messages[i]
                  // Message is unread if it's from the other person and current user is not in readBy
                  const isFromOther = msg.senderId.email !== session.user.email
                  const isUnread = !msg.readBy || msg.readBy.length <= 1 // Only sender has read it
                  
                  if (isFromOther && isUnread) {
                    unreadMessages.push(msg)
                  }
                }
                
                if (unreadMessages.length > 0) {
                  setFirstUnreadMessageId(unreadMessages[0]._id)
                  setShowUnreadDivider(true)
                  setTimeout(() => setShowUnreadDivider(false), 3000)
                }
              }
            }
          }
          
          if (messagesRes.ok) {
            setMessages(messagesData.messages || [])
            setHasMore(messagesData.hasMore || false)
          }

          // Mark messages as read
          await fetch('/api/markAsRead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dmId })
          })
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [channelId, dmId])

  // Socket.IO for real-time messaging
  useEffect(() => {
    if (!socket) {
      console.log('Socket not available')
      return
    }

    // Handle DM
    if (dmId) {
      console.log('Setting up socket listeners for DM:', dmId)

      // Join DM room
      socket.emit('join-dm', dmId)

      // Listen for new messages from other users
      const handleNewMessage = (newMessage) => {
        console.log('Received new message:', newMessage)
        setMessages(prev => {
          if (prev.some(msg => msg._id === newMessage._id)) {
            return prev
          }
          return [...prev, newMessage]
        })
        scrollToBottom()

        // Mark as read immediately if chat is open
        fetch('/api/markAsRead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dmId })
        }).then(() => {
          if (socket) {
            socket.emit('mark-read', { dmId, userId: 'current-user-id' })
          }
        })
      }

      // Listen for read receipts
      const handleMessagesRead = ({ userId }) => {
        console.log('Messages read by user:', userId)
        setMessages(prev => prev.map(msg => ({
          ...msg,
          readBy: msg.readBy.includes(userId) ? msg.readBy : [...msg.readBy, userId]
        })))
      }

      // Listen for typing indicator
      const handleUserTyping = ({ userName }) => {
        console.log('User typing:', userName)
        setTyping(userName)
      }

      const handleUserStopTyping = () => {
        console.log('User stopped typing')
        setTyping(false)
      }

      socket.on('new-message', handleNewMessage)
      socket.on('messages-read', handleMessagesRead)
      socket.on('user-typing', handleUserTyping)
      socket.on('user-stop-typing', handleUserStopTyping)

      return () => {
        console.log('Cleaning up socket listeners for DM:', dmId)
        socket.emit('leave-dm', dmId)
        socket.off('new-message', handleNewMessage)
        socket.off('messages-read', handleMessagesRead)
        socket.off('user-typing', handleUserTyping)
        socket.off('user-stop-typing', handleUserStopTyping)
      }
    }

    // Handle Channel
    if (channelId) {
      console.log('Setting up socket listeners for Channel:', channelId)

      // Join Channel room
      socket.emit('join-channel', channelId)

      // Listen for new messages
      const handleNewChannelMessage = (newMessage) => {
        console.log('ChatInterface received new-channel-message:', newMessage)
        console.log('  Message channel:', newMessage.channelId, 'Current channel:', channelId)
        
        // ONLY add message if it's for the CURRENT channel
        if (newMessage.channelId !== channelId) {
          console.log('  ❌ Ignoring - message is for different channel')
          return
        }
        
        console.log('  ✅ Adding message to current channel')
        setMessages(prev => {
          if (prev.some(msg => msg._id === newMessage._id)) {
            return prev
          }
          
          // If this is the first new message after entering the channel, mark it for divider
          if (lastReadMessageId && !firstUnreadMessageId) {
            console.log('Setting first unread message for divider:', newMessage._id)
            setFirstUnreadMessageId(newMessage._id)
            setShowUnreadDivider(true)
            setTimeout(() => setShowUnreadDivider(false), 3000)
          }
          
          return [...prev, newMessage]
        })
        scrollToBottom()
      }

      // Listen for typing indicator
      const handleChannelUserTyping = ({ userName }) => {
        console.log('User typing in channel:', userName)
        setTyping(userName)
      }

      const handleChannelUserStopTyping = () => {
        console.log('User stopped typing in channel')
        setTyping(false)
      }

      socket.on('new-channel-message', handleNewChannelMessage)
      socket.on('channel-user-typing', handleChannelUserTyping)
      socket.on('channel-user-stop-typing', handleChannelUserStopTyping)

      return () => {
        console.log('Cleaning up socket listeners for Channel:', channelId)
        socket.emit('leave-channel', channelId)
        socket.off('new-channel-message', handleNewChannelMessage)
        socket.off('channel-user-typing', handleChannelUserTyping)
        socket.off('channel-user-stop-typing', handleChannelUserStopTyping)
      }
    }
  }, [socket, dmId, channelId])

  // Auto-scroll to bottom when new messages arrive (only for new messages, not initial load)
  const prevMessagesLengthRef = useRef(0)
  useEffect(() => {
    // Scroll to bottom when new messages are added
    if (messages.length > prevMessagesLengthRef.current && prevMessagesLengthRef.current > 0) {
      setTimeout(() => scrollToBottom(), 50)
    }
    prevMessagesLengthRef.current = messages.length
  }, [messages])

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }

  const loadMoreMessages = async () => {
    if ((!dmId && !channelId) || loadingMore || !hasMore || messages.length === 0) return

    setLoadingMore(true)
    const oldestMessageId = messages[0]._id

    try {
      const queryParam = dmId ? `dmId=${dmId}` : `channelId=${channelId}`
      const res = await fetch(`/api/getMessages?${queryParam}&limit=30&before=${oldestMessageId}`)
      const data = await res.json()

      if (res.ok && data.messages.length > 0) {
        setMessages(prev => [...data.messages, ...prev])
        setHasMore(data.hasMore || false)
      }
    } catch (error) {
      console.error('Error loading more messages:', error)
    } finally {
      setLoadingMore(false)
    }
  }

  // Handle scroll for infinite loading (reversed)
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target
    // In flex-col-reverse, scrollTop is negative when scrolling up
    // When we reach the top (oldest messages), load more
    const distanceFromBottom = scrollHeight + scrollTop - clientHeight
    if (distanceFromBottom <= 1 && hasMore && !loadingMore) {
      loadMoreMessages()
    }
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!message.trim() || sending) return

    setSending(true)
    const messageContent = message.trim()
    setMessage('')

    // Stop typing indicator
    if (socket) {
      if (dmId) {
        socket.emit('stop-typing', { dmId })
      } else if (channelId) {
        socket.emit('channel-stop-typing', { channelId })
      }
    }

    try {
      const res = await fetch('/api/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dmId,
          channelId,
          content: messageContent
        })
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Failed to send message')
        setMessage(messageContent)
        return
      }

      // Add message to local state
      setMessages(prev => [...prev, data.message])

      // Scroll to bottom after sending
      setTimeout(() => scrollToBottom(), 100)

      // Broadcast message via socket
      if (socket) {
        if (dmId) {
          console.log('Emitting message via socket to dm:', dmId)
          socket.emit('send-message', {
            dmId,
            message: data.message
          })
        } else if (channelId) {
          console.log('Emitting message via socket to channel:', channelId)
          socket.emit('send-channel-message', {
            channelId,
            message: data.message
          })
        }
      } else {
        console.log('Socket not available for broadcasting')
      }
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message')
      setMessage(messageContent)
    } finally {
      setSending(false)
    }
  }

  const handleTyping = (e) => {
    setMessage(e.target.value)

    if (!socket) return

    // Emit typing indicator
    if (dmId) {
      socket.emit('typing', { dmId, userName: 'User' })
    } else if (channelId) {
      socket.emit('channel-typing', { channelId, userName: 'User' })
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (dmId) {
        socket.emit('stop-typing', { dmId })
      } else if (channelId) {
        socket.emit('channel-stop-typing', { channelId })
      }
    }, 2000)
  }

  const handleEmojiClick = (emojiData) => {
    setMessage(prev => prev + emojiData.emoji)
    setShowEmojiPicker(false)
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large. Maximum size is 10MB')
      return
    }

    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Upload failed')
        return
      }

      // Send message with file attachment
      const messageRes = await fetch('/api/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dmId,
          channelId,
          content: file.name,
          fileUrl: data.fileUrl,
          fileName: data.fileName,
          fileType: data.fileType,
          fileSize: data.fileSize,
          mimeType: data.mimeType
        })
      })

      const messageData = await messageRes.json()

      if (!messageRes.ok) {
        alert(messageData.error || 'Failed to send file')
        return
      }

      // Add message to local state
      setMessages(prev => [...prev, messageData.message])
      setTimeout(() => scrollToBottom(), 100)

      // Broadcast via socket
      if (socket) {
        if (dmId) {
          socket.emit('send-message', { dmId, message: messageData.message })
        } else if (channelId) {
          socket.emit('send-channel-message', { channelId, message: messageData.message })
        }
      }
    } catch (error) {
      console.error('File upload error:', error)
      alert('Failed to upload file')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleSettingsMouseEnter = () => {
    if (settingsTimeoutRef.current) {
      clearTimeout(settingsTimeoutRef.current)
    }
    setShowSettingsPopup(true)
  }

  const handleSettingsMouseLeave = () => {
    settingsTimeoutRef.current = setTimeout(() => {
      setShowSettingsPopup(false)
    }, 500)
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const handleDeleteChannel = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete #${channel.name}? This action cannot be undone and will remove all members.`
    )

    if (!confirmed) return

    try {
      const res = await fetch('/api/deleteChannel', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: channel._id })
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Failed to delete channel')
        return
      }

      alert('Channel deleted successfully!')
      window.location.href = '/dashboard'
    } catch (error) {
      console.error('Error deleting channel:', error)
      alert('An error occurred. Please try again.')
    }
  }

  const handleOpenEditModal = () => {
    setEditForm({
      name: channel.name,
      description: channel.description || ''
    })
    setEditError('')
    setShowEditModal(true)
    setShowSettingsPopup(false)
  }

  const handleEditFormChange = (e) => {
    const { name, value } = e.target
    
    if (name === 'name') {
      const formattedValue = value.replace(/\s+/g, '-')
      setEditForm({ ...editForm, [name]: formattedValue })
    } else {
      setEditForm({ ...editForm, [name]: value })
    }
  }

  const handleUpdateChannel = async (e) => {
    e.preventDefault()
    setEditError('')
    setEditLoading(true)

    try {
      const res = await fetch('/api/updateChannel', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: channel._id,
          name: editForm.name,
          description: editForm.description
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setEditError(data.error || 'Failed to update channel')
        setEditLoading(false)
        return
      }

      // Update local channel state
      setChannel({ ...channel, name: data.channel.name, description: data.channel.description })
      setShowEditModal(false)
      alert('Channel updated successfully!')
    } catch (error) {
      console.error('Error updating channel:', error)
      setEditError('An error occurred. Please try again.')
    } finally {
      setEditLoading(false)
    }
  }

  if (!channelId && !dmId) {
    return (
      <div className="w-full h-full flex items-center justify-center overflow-hidden">
        <div className="text-center">
          <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-4 mx-auto">
            <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-white text-xl font-semibold mb-2">Welcome to your workspace</h3>
          <p className="text-gray-400 max-w-md">
            Select a channel or direct message from the sidebar to start chatting
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center overflow-hidden">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!channel && !dm) {
    return (
      <div className="w-full h-full flex items-center justify-center overflow-hidden">
        <div className="text-center">
          <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-4 mx-auto">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-white text-xl font-semibold mb-2">Not found</h3>
          <p className="text-gray-400">This conversation doesn't exist or you don't have access to it</p>
        </div>
      </div>
    )
  }

  // Render DM interface
  if (dm) {
    return (
      <div className="w-full h-full flex flex-col overflow-hidden">
        {/* DM Header */}
        <div className="h-16 bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
              {dm.user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm md:text-base">{dm.user?.name || 'Unknown User'}</h3>
              <p className="text-gray-400 text-xs hidden md:block">{dm.user?.email || ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition duration-200">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition duration-200">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div 
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar relative flex flex-col-reverse"
        >
          {/* Unread Messages Banner */}
          {showUnreadBanner && unreadCount > 0 && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg animate-fadeIn">
              <span className="text-sm font-medium">{unreadCount} unread {unreadCount === 1 ? 'message' : 'messages'}</span>
            </div>
          )}

          {/* Loading More Indicator - removed from here, now inside messages div */}
          
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-600 rounded-full flex items-center justify-center mb-4 text-white font-bold text-2xl">
                {dm.user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <h3 className="text-white text-lg md:text-xl font-semibold mb-2">
                This is the beginning of your conversation with {dm.user?.name}
              </h3>
              <p className="text-gray-400 text-sm md:text-base max-w-md">
                Start chatting now!
              </p>
            </div>
          ) : (
            <div className="space-y-4 flex flex-col-reverse">
              <div ref={messagesEndRef} />
              {messages.slice().reverse().map((msg, index) => {
                const reversedIndex = messages.length - 1 - index
                const isOwnMessage = msg.senderId._id === dm.user?._id ? false : true
                const showAvatar = reversedIndex === messages.length - 1 || messages[reversedIndex + 1].senderId._id !== msg.senderId._id
                const isFirstUnread = showUnreadDivider && msg._id === firstUnreadMessageId
                
                return (
                  <div key={msg._id}>
                    {/* Unread Messages Divider */}
                    {isFirstUnread && (
                      <div className="flex items-center gap-3 my-4 animate-fadeIn">
                        <div className="flex-1 h-px bg-red-500"></div>
                        <span className="text-red-500 text-xs font-semibold uppercase px-2 py-1 bg-gray-900 rounded">
                          {unreadCount} New {unreadCount === 1 ? 'Message' : 'Messages'}
                        </span>
                        <div className="flex-1 h-px bg-red-500"></div>
                      </div>
                    )}
                    
                    <div className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''} w-full`}>
                    {showAvatar ? (
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                        {msg.senderId.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    ) : (
                      <div className="w-8 shrink-0"></div>
                    )}
                    <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} max-w-[70%] min-w-0 flex-1`}>
                      {showAvatar && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white text-sm font-semibold">{msg.senderId.name}</span>
                          <span className="text-gray-500 text-xs">
                            {new Date(msg.createdAt).toLocaleTimeString('en-US', { 
                              hour: 'numeric', 
                              minute: '2-digit',
                              hour12: true 
                            })}
                          </span>
                        </div>
                      )}
                      <div className={`px-4 py-2 rounded-lg max-w-full overflow-hidden ${
                        isOwnMessage 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-800 text-white'
                      }`}>
                        {/* File/Image Display */}
                        {msg.fileUrl && msg.fileType === 'image' && (
                          <div className="mb-2">
                            <img 
                              src={msg.fileUrl} 
                              alt={msg.fileName} 
                              className="max-w-full max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition"
                              onClick={() => window.open(msg.fileUrl, '_blank')}
                            />
                          </div>
                        )}
                        {msg.fileUrl && msg.fileType === 'document' && (
                          <a 
                            href={msg.fileUrl} 
                            download={msg.fileName}
                            className="flex items-center gap-2 p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition mb-2"
                          >
                            <svg className="w-6 h-6 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{msg.fileName}</p>
                              <p className="text-xs text-gray-400">{(msg.fileSize / 1024).toFixed(1)} KB</p>
                            </div>
                            <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </a>
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words overflow-wrap-anywhere">{msg.content}</p>
                        {isOwnMessage && (
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-xs opacity-70">
                              {new Date(msg.createdAt).toLocaleTimeString('en-US', { 
                                hour: 'numeric', 
                                minute: '2-digit',
                                hour12: true 
                              })}
                            </span>
                            {/* Green double tick if read by other person, gray single tick if only sent */}
                            {msg.readBy && msg.readBy.length > 1 ? (
                              <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M0 11l2-2 5 5L18 3l2 2L7 18z"/>
                                <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" transform="translate(3, 0)"/>
                              </svg>
                            ) : (
                              <svg className="w-3 h-3 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M0 11l2-2 5 5L18 3l2 2L7 18z"/>
                              </svg>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  </div>
                )
              })}
              {/* Loading More Indicator at top */}
              {loadingMore && (
                <div className="flex justify-center py-2">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          )}
          {typing && (
            <div className="flex items-center gap-2 mt-4 text-gray-400 text-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
              <span>{typing} is typing...</span>
            </div>
          )}
        </div>

        {/* Message Input */}
        <div className="p-3 md:p-4 border-t border-gray-800">
          {/* Emoji Picker */}
          {showEmojiPicker && (
            <div className="absolute bottom-20 left-4 z-50">
              <EmojiPicker onEmojiClick={handleEmojiClick} theme="dark" />
            </div>
          )}

          <form onSubmit={handleSend} className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.zip,.rar"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <div className="flex items-center gap-2 bg-gray-800 rounded-lg border border-gray-700 focus-within:border-blue-500 transition duration-200">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="p-2 md:p-3 text-gray-400 hover:text-white transition duration-200 disabled:opacity-50"
                title="Upload file"
              >
                {uploading ? (
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                )}
              </button>
              <input
                type="text"
                value={message}
                onChange={handleTyping}
                placeholder={`Message ${dm.user?.name || 'user'}`}
                className="flex-1 bg-transparent text-white py-2 md:py-3 focus:outline-none text-sm md:text-base"
              />
              <div className="flex items-center gap-1 pr-2">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-2 text-gray-400 hover:text-white transition duration-200"
                  title="Add emoji"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
                <button
                  type="submit"
                  disabled={!message.trim() || sending || uploading}
                  className="p-2 text-blue-500 hover:text-blue-400 disabled:text-gray-600 disabled:cursor-not-allowed transition duration-200"
                >
                  {sending ? (
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <p className="text-gray-500 text-xs mt-2 hidden md:block">
              <span className="font-semibold">Shift + Enter</span> to add a new line
            </p>
          </form>
        </div>
      </div>
    )
  }

  // Render Channel interface
  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* Chat Header */}
      <div className="h-16 bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <span className="text-xl md:text-2xl text-gray-400">#</span>
          <div>
            <h3 className="text-white font-semibold text-sm md:text-base">{channel.name}</h3>
            <p className="text-gray-400 text-xs hidden md:block">
              {channel.description || 'No description'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {channel.isAdmin && (
            <div 
              className="relative"
              onMouseEnter={handleSettingsMouseEnter}
              onMouseLeave={handleSettingsMouseLeave}
            >
              <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition duration-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              {/* Settings Popup */}
              {showSettingsPopup && (
                <div 
                  className="absolute right-0 top-full mt-2 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl p-4 z-50 animate-fadeIn"
                  onMouseEnter={handleSettingsMouseEnter}
                  onMouseLeave={handleSettingsMouseLeave}
                >
                  <div className="space-y-3">
                    <div>
                      <p className="text-gray-400 text-xs font-semibold uppercase mb-1">Channel Info</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          <span className="text-white text-sm">
                            {channel.memberCount} {channel.memberCount === 1 ? 'member' : 'members'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-white text-sm">
                            Created {formatDate(channel.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-gray-700">
                      <p className="text-yellow-400 text-xs flex items-center gap-1 mb-3">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                        </svg>
                        Admin
                      </p>
                      <div className="space-y-2">
                        <button
                          onClick={handleOpenEditModal}
                          className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition duration-200 flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit Channel
                        </button>
                        <button
                          onClick={handleDeleteChannel}
                          className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition duration-200 flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete Channel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition duration-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition duration-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar relative flex flex-col-reverse"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 md:w-10 md:h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-white text-lg md:text-xl font-semibold mb-2">Welcome to #{channel.name}</h3>
            <p className="text-gray-400 text-sm md:text-base max-w-md">
              This is the beginning of your conversation. Start chatting with your team!
            </p>
          </div>
        ) : (
          <div className="space-y-4 flex flex-col-reverse">
            <div ref={messagesEndRef} />
            {messages.slice().reverse().map((msg, index) => {
              const reversedIndex = messages.length - 1 - index
              const isOwnMessage = session?.user?.email === msg.senderId.email
              const showAvatar = reversedIndex === messages.length - 1 || messages[reversedIndex + 1].senderId._id !== msg.senderId._id
              const isFirstUnread = showUnreadDivider && msg._id === firstUnreadMessageId
              
              return (
                <div key={msg._id}>
                  {/* Unread Messages Divider */}
                  {isFirstUnread && (
                    <div className="flex items-center gap-3 my-4 animate-fadeIn">
                      <div className="flex-1 h-px bg-red-500"></div>
                      <span className="text-red-500 text-xs font-semibold uppercase px-2 py-1 bg-gray-900 rounded">
                        New Messages
                      </span>
                      <div className="flex-1 h-px bg-red-500"></div>
                    </div>
                  )}
                  
                  <div className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''} w-full`}>
                  {showAvatar ? (
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                      {msg.senderId.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  ) : (
                    <div className="w-8 shrink-0"></div>
                  )}
                  <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} max-w-[70%] min-w-0 flex-1`}>
                    {showAvatar && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white text-sm font-semibold">{msg.senderId.name}</span>
                        <span className="text-gray-500 text-xs">
                          {new Date(msg.createdAt).toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit',
                            hour12: true 
                          })}
                        </span>
                      </div>
                    )}
                    <div className={`px-4 py-2 rounded-lg max-w-full overflow-hidden ${isOwnMessage ? 'bg-blue-600 text-white' : 'bg-gray-800 text-white'}`}>
                      {/* File/Image Display */}
                      {msg.fileUrl && msg.fileType === 'image' && (
                        <div className="mb-2">
                          <img 
                            src={msg.fileUrl} 
                            alt={msg.fileName} 
                            className="max-w-full max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition"
                            onClick={() => window.open(msg.fileUrl, '_blank')}
                          />
                        </div>
                      )}
                      {msg.fileUrl && msg.fileType === 'document' && (
                        <a 
                          href={msg.fileUrl} 
                          download={msg.fileName}
                          className="flex items-center gap-2 p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition mb-2"
                        >
                          <svg className="w-6 h-6 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{msg.fileName}</p>
                            <p className="text-xs text-gray-400">{(msg.fileSize / 1024).toFixed(1)} KB</p>
                          </div>
                          <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </a>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words overflow-wrap-anywhere">{msg.content}</p>
                    </div>
                  </div>
                </div>
                </div>
              )
            })}
            {/* Loading More Indicator at top */}
            {loadingMore && (
              <div className="flex justify-center py-2">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
        )}
        {typing && (
          <div className="flex items-center gap-2 mt-4 text-gray-400 text-sm">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
            <span>{typing} is typing...</span>
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className="p-3 md:p-4 border-t border-gray-800">
        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div className="absolute bottom-20 left-4 z-50">
            <EmojiPicker onEmojiClick={handleEmojiClick} theme="dark" />
          </div>
        )}

        <form onSubmit={handleSend} className="relative">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.zip,.rar"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="flex items-center gap-2 bg-gray-800 rounded-lg border border-gray-700 focus-within:border-blue-500 transition duration-200">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="p-2 md:p-3 text-gray-400 hover:text-white transition duration-200 disabled:opacity-50"
              title="Upload file"
            >
              {uploading ? (
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              )}
            </button>
            <input
              type="text"
              value={message}
              onChange={handleTyping}
              placeholder={`Message #${channel.name}`}
              className="flex-1 bg-transparent text-white py-2 md:py-3 focus:outline-none text-sm md:text-base"
            />
            <div className="flex items-center gap-1 pr-2">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-2 text-gray-400 hover:text-white transition duration-200"
                title="Add emoji"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <button
                type="submit"
                disabled={!message.trim() || sending || uploading}
                className="p-2 text-blue-500 hover:text-blue-400 disabled:text-gray-600 disabled:cursor-not-allowed transition duration-200"
              >
                {sending ? (
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <p className="text-gray-500 text-xs mt-2 hidden md:block">
            <span className="font-semibold">Shift + Enter</span> to add a new line
          </p>
        </form>
      </div>

      {/* Edit Channel Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto modal-scrollbar">
          <div className="flex min-h-full items-start justify-center py-8">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowEditModal(false)}
            ></div>
            <div className="relative bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg mx-4 shadow-2xl my-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-white">Edit Channel</h2>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="text-gray-400 hover:text-white transition duration-200"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleUpdateChannel} className="space-y-5">
                  {editError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm flex items-start gap-2">
                      <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{editError}</span>
                    </div>
                  )}

                  <div>
                    <label htmlFor="edit-name" className="block text-sm font-medium text-gray-300 mb-2">
                      Channel Name
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg">#</span>
                      <input
                        type="text"
                        id="edit-name"
                        name="name"
                        value={editForm.name}
                        onChange={handleEditFormChange}
                        placeholder="e.g. project-updates"
                        required
                        className="w-full px-4 py-3 pl-8 bg-gray-800 text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <p className="text-gray-500 text-xs mt-1">Spaces will be automatically converted to hyphens</p>
                  </div>

                  <div>
                    <label htmlFor="edit-description" className="block text-sm font-medium text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      id="edit-description"
                      name="description"
                      value={editForm.description}
                      onChange={handleEditFormChange}
                      placeholder="What's this channel about?"
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-800 text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowEditModal(false)}
                      disabled={editLoading}
                      className="flex-1 px-4 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={editLoading}
                      className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {editLoading ? 'Updating...' : 'Update Channel'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChatInterface
