"use client"
import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSocket } from '@/lib/SocketContext'
import { useSession } from 'next-auth/react'

const ChannelSidebar = ({ onNavigate }) => {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const channelIdFromUrl = searchParams.get('channel')
  const [activeChannel, setActiveChannel] = useState(channelIdFromUrl || '')
  const [showChannelModal, setShowChannelModal] = useState(false)
  const [showDMModal, setShowDMModal] = useState(false)
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchedUsers, setSearchedUsers] = useState([])
  const [searchingUsers, setSearchingUsers] = useState(false)
  const [searchedChannels, setSearchedChannels] = useState([])
  const [searchingChannels, setSearchingChannels] = useState(false)
  const [createdChannels, setCreatedChannels] = useState([])
  const [joinedChannels, setJoinedChannels] = useState([])
  const [directMessages, setDirectMessages] = useState([])
  const [channelUnreadCounts, setChannelUnreadCounts] = useState({}) // Track unread counts per channel
  const [loadingChannels, setLoadingChannels] = useState(true)
  const [showChannelsSection, setShowChannelsSection] = useState(true)
  const [showAllCreated, setShowAllCreated] = useState(false)
  const [showAllJoined, setShowAllJoined] = useState(false)
  const [showAllDMs, setShowAllDMs] = useState(false)
  const { socket, isConnected } = useSocket()
  const joinedRoomsRef = useRef(new Set())

  // last-seen timestamps for channels and DMs (client-only)
  // stored in refs to avoid re-renders; used to decide whether to increment unread
  const lastSeenChannelRef = useRef({}) // { [channelId]: timestampMillis }
  const lastSeenDmRef = useRef({}) // { [dmId]: timestampMillis }

  // Expose function to clear channel unread count (for testing / external calls)
  useEffect(() => {
    window.clearChannelUnread = (channelId) => {
      console.log('Clearing unread count for channel:', channelId)
      setChannelUnreadCounts(prev => ({
        ...prev,
        [channelId]: 0
      }))
      if (socket && socket.connected) socket.emit('mark-channel-read', String(channelId))
    }
    
    return () => {
      delete window.clearChannelUnread
    }
  }, [socket])

  const [channelForm, setChannelForm] = useState({
    name: '',
    description: '',
    visibility: 'public'
  })

  // Check URL params on mount (modals)
  useEffect(() => {
    const modal = searchParams.get('modal')
    if (modal === 'channels') {
      setShowChannelModal(true)
    } else if (modal === 'dm') {
      setShowDMModal(true)
    } else if (modal === 'create-channel') {
      setShowCreateChannelModal(true)
    }
  }, [searchParams])

  // Keep activeChannel in sync with URL param (fix: activeChannel getting out of sync)
  useEffect(() => {
    const ch = searchParams.get('channel')
    if (ch) {
      setActiveChannel(ch)
    } else {
      setActiveChannel('')
    }
  }, [searchParams])

  // Fetch user's created channels on mount
  useEffect(() => {
    const fetchChannels = async () => {
      setLoadingChannels(true)
      try {
        const [createdRes, joinedRes, dmsRes] = await Promise.all([
          fetch('/api/fetchChannels'),
          fetch('/api/fetchJoinedChannels'),
          fetch('/api/fetchDMs')
        ])
        
        const createdData = await createdRes.json()
        const joinedData = await joinedRes.json()
        const dmsData = await dmsRes.json()
        
        if (createdRes.ok) {
          setCreatedChannels(createdData.channels || [])
        }
        
        if (joinedRes.ok) {
          setJoinedChannels(joinedData.channels || [])
        }

        if (dmsRes.ok) {
          setDirectMessages(dmsData.dms || [])
        }
      } catch (error) {
        console.error('Error fetching channels:', error)
      } finally {
        setLoadingChannels(false)
      }
    }

    fetchChannels()
  }, [])

  // Listen for new messages using shared socket (same as ChatInterface)
  useEffect(() => {
    if (!socket || !isConnected) {
      console.log('Sidebar waiting for socket connection...')
      return
    }

    console.log('Sidebar setting up new-message listener on socket:', socket.id)

    // Helper to safely parse timestamps
    const toMillis = (t) => {
      if (!t) return 0
      const m = new Date(t).getTime()
      return isNaN(m) ? 0 : m
    }

    // Listen for DM messages
    const handleNewMessage = (newMessage) => {
      try {
        const dmId = String(newMessage.dmId)
        const messageTs = toMillis(newMessage.createdAt) || Date.now()
        const currentUrl = new URL(window.location.href)
        const dmIdFromUrl = currentUrl.searchParams.get('dm')
        const isCurrentlyOpen = dmIdFromUrl && String(dmIdFromUrl) === dmId

        // Update last-seen for this DM if it's currently open
        if (isCurrentlyOpen) {
          lastSeenDmRef.current[dmId] = Math.max(lastSeenDmRef.current[dmId] || 0, messageTs)
          // clear unread in UI
          setDirectMessages(prev => prev.map(dm => 
            String(dm._id) === dmId ? { ...dm, unreadCount: 0, lastMessage: { ...dm.lastMessage, content: newMessage.content, createdAt: newMessage.createdAt, isRead: true }, lastMessageAt: new Date(newMessage.createdAt) } : dm
          ))
          // notify server read
          if (socket && socket.connected) socket.emit('mark-dm-read', dmId)
          return
        }

        // If user has a last-seen timestamp >= messageTs, ignore (already seen)
        const lastSeen = lastSeenDmRef.current[dmId] || 0
        if (lastSeen >= messageTs) {
          // still update last message content/time without incrementing unread
          setDirectMessages(prev => prev.map(dm => 
            String(dm._id) === dmId ? { ...dm, lastMessage: { content: newMessage.content, createdAt: newMessage.createdAt }, lastMessageAt: new Date(newMessage.createdAt) } : dm
          ))
          return
        }

        // Update DM list / unread
        setDirectMessages(prev => {
          let found = false
          const updated = prev.map(dm => {
            if (String(dm._id) === dmId) {
              found = true
              const newUnread = (dm.unreadCount || 0) + 1
              return {
                ...dm,
                lastMessage: {
                  content: newMessage.content,
                  senderId: newMessage.senderId?._id || newMessage.senderId,
                  senderName: newMessage.senderId?.name || newMessage.senderName || '',
                  createdAt: newMessage.createdAt,
                  isRead: false
                },
                unreadCount: newUnread,
                lastMessageAt: new Date(newMessage.createdAt)
              }
            }
            return dm
          })

          if (!found) {
            const senderObj = typeof newMessage.senderId === 'object'
              ? newMessage.senderId
              : { _id: newMessage.senderId, name: newMessage.senderName || 'Unknown' }

            const newDm = {
              _id: dmId,
              user: senderObj,
              lastMessage: {
                content: newMessage.content,
                senderId: senderObj._id,
                senderName: senderObj.name || '',
                createdAt: newMessage.createdAt,
                isRead: false
              },
              unreadCount: 1,
              lastMessageAt: new Date(newMessage.createdAt)
            }

            return [newDm, ...updated].sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
          }

          return updated.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
        })
      } catch (err) {
        console.error('handleNewMessage error:', err)
      }
    }

    // Listen for channel messages
    const handleNewChannelMessage = (newMessage) => {
      try {
        const messageChannelId = String(newMessage.channelId)

        // Don't increment if this is MY message
        if (session?.user?.email && newMessage.senderId?.email === session.user.email) {
          return
        }

        // If channel currently open (via URL), treat as read
        const currentUrl = new URL(window.location.href)
        const channelIdFromUrl = currentUrl.searchParams.get('channel')
        const isCurrentlyOpen = channelIdFromUrl && String(channelIdFromUrl) === messageChannelId

        if (isCurrentlyOpen) {
          // Clear UI badge for currently open channel
          setChannelUnreadCounts(prev => ({ ...prev, [messageChannelId]: 0 }))
          if (socket && socket.connected) socket.emit('mark-channel-read', messageChannelId)
          return
        }

        // Otherwise increment unread count for messages from others
        setChannelUnreadCounts(prev => {
          const newCount = (prev[messageChannelId] || 0) + 1
          return {
            ...prev,
            [messageChannelId]: newCount
          }
        })
      } catch (err) {
        console.error('handleNewChannelMessage error:', err)
      }
    }

    socket.on('new-message', handleNewMessage)
    socket.on('new-channel-message', handleNewChannelMessage)

    return () => {
      socket.off('new-message', handleNewMessage)
      socket.off('new-channel-message', handleNewChannelMessage)
    }
  }, [socket, isConnected, session])

  // Join DM rooms when directMessages are loaded
  useEffect(() => {
    if (!socket || !isConnected) return
    if (directMessages.length === 0) return

    directMessages.forEach(dm => {
      if (!joinedRoomsRef.current.has(`dm-${dm._id}`)) {
        socket.emit('join-dm', dm._id)
        joinedRoomsRef.current.add(`dm-${dm._id}`)
      }
    })
  }, [socket, isConnected, directMessages.length])

  // Join Channel rooms when channels are loaded
  useEffect(() => {
    if (!socket || !isConnected) return

    const allChannels = [...createdChannels, ...joinedChannels]
    if (allChannels.length === 0) return

    allChannels.forEach(channel => {
      const roomKey = `channel-${channel._id}`
      if (!joinedRoomsRef.current.has(roomKey)) {
        socket.emit('join-channel', channel._id)
        joinedRoomsRef.current.add(roomKey)
      }
    })
  }, [socket, isConnected, createdChannels.length, joinedChannels.length])

  // Clear unread count when clicking on a channel (and notify server)
  const handleChannelClick = (channelId) => {
    const id = String(channelId)
    setActiveChannel(id)
    setChannelUnreadCounts(prev => ({
      ...prev,
      [id]: 0
    }))
    if (socket && socket.connected) {
      socket.emit('mark-channel-read', id)
    }
    router.push(`/dashboard?channel=${id}`)
    if (onNavigate) onNavigate() // Close mobile sidebar
  }

  // Clear unread when opening a DM
  const handleOpenDm = (dmId) => {
    const id = String(dmId)
    setActiveChannel(id)
    lastSeenDmRef.current[id] = Date.now()
    setDirectMessages(prev => prev.map(d => d._id === id ? { ...d, unreadCount: 0 } : d))
    if (socket && socket.connected) socket.emit('mark-dm-read', id)
    router.push(`/dashboard?dm=${id}`)
    if (onNavigate) onNavigate() // Close mobile sidebar
  }

  // Search users when query changes in DM modal
  useEffect(() => {
    if (!showDMModal) return

    const searchUsers = async () => {
      if (!searchQuery.trim()) {
        setSearchedUsers([])
        return
      }

      setSearchingUsers(true)
      try {
        const res = await fetch(`/api/searchUsers?q=${encodeURIComponent(searchQuery)}`)
        const data = await res.json()
        
        if (res.ok) {
          setSearchedUsers(data.users || [])
        } else {
          setSearchedUsers([])
        }
      } catch (error) {
        console.error('Error searching users:', error)
        setSearchedUsers([])
      } finally {
        setSearchingUsers(false)
      }
    }

    const debounce = setTimeout(searchUsers, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery, showDMModal])

  // Search channels when query changes in channel modal
  useEffect(() => {
    if (!showChannelModal) return

    const searchChannels = async () => {
      if (!searchQuery.trim()) {
        setSearchedChannels([])
        return
      }

      setSearchingChannels(true)
      try {
        const res = await fetch(`/api/searchChannels?q=${encodeURIComponent(searchQuery)}`)
        const data = await res.json()
        
        if (res.ok) {
          setSearchedChannels(data.channels || [])
        } else {
          setSearchedChannels([])
        }
      } catch (error) {
        console.error('Error searching channels:', error)
        setSearchedChannels([])
      } finally {
        setSearchingChannels(false)
      }
    }

    const debounce = setTimeout(searchChannels, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery, showChannelModal])

  const openChannelModal = () => {
    setShowChannelModal(true)
    setSearchQuery('')
    setSearchedChannels([])
    router.push('?modal=channels', { scroll: false })
  }

  const closeChannelModal = () => {
    setShowChannelModal(false)
    setSearchQuery('')
    setSearchedChannels([])
    router.push('/dashboard', { scroll: false })
  }

  const openDMModal = () => {
    setShowDMModal(true)
    setSearchQuery('')
    setSearchedUsers([])
    router.push('?modal=dm', { scroll: false })
  }

  const closeDMModal = () => {
    setShowDMModal(false)
    setSearchQuery('')
    setSearchedUsers([])
    router.push('/dashboard', { scroll: false })
  }

  const openCreateChannelModal = () => {
    setShowChannelModal(false)
    setShowCreateChannelModal(true)
    router.push('?modal=create-channel', { scroll: false })
  }

  const closeCreateChannelModal = () => {
    setShowCreateChannelModal(false)
    setChannelForm({ name: '', description: '', visibility: 'public' })
    setError('')
    setLoading(false)
    router.push('/dashboard', { scroll: false })
  }

  const handleCreateChannel = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch("/api/createChannel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(channelForm)
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error || 'Failed to create channel')
        setLoading(false)
        return
      }
      
      // Add new channel to created channels list
      setCreatedChannels([...createdChannels, data.channel])
      closeCreateChannelModal()
      
    } catch (error) {
      console.error("Create channel error:", error)
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  const handleFormChange = (e) => {
    const { name, value } = e.target
    
    if (name === 'name') {
      const formattedValue = value.replace(/\s+/g, '-')
      setChannelForm({ ...channelForm, [name]: formattedValue })
    } else {
      setChannelForm({ ...channelForm, [name]: value })
    }
  }

  const handleJoinChannel = async (channelId) => {
    try {
      const res = await fetch('/api/joinChannel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId })
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Failed to join channel')
        return
      }

      // Add channel to joined channels list
      if (data.channel) {
        setJoinedChannels([...joinedChannels, data.channel])
      }

      // Remove from search results
      setSearchedChannels(searchedChannels.filter(ch => ch._id !== channelId))
      
      alert('Successfully joined channel!')
    } catch (error) {
      console.error('Error joining channel:', error)
      alert('An error occurred. Please try again.')
    }
  }

  const handleStartDM = async (userId) => {
    try {
      const res = await fetch('/api/createDM', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Failed to start DM')
        return
      }

      // Add DM to list if it's new
      const dmExists = directMessages.some(dm => dm._id === data.dm._id)
      if (!dmExists) {
        const otherParticipant = data.dm.participants.find(p => p._id !== userId)
        setDirectMessages([{
          _id: data.dm._id,
          user: otherParticipant,
          lastMessageAt: data.dm.lastMessageAt
        }, ...directMessages])
      }

      // mark last seen for new DM and navigate
      lastSeenDmRef.current[String(data.dm._id)] = Date.now()
      closeDMModal()
      router.push(`/dashboard?dm=${data.dm._id}`)
    } catch (error) {
      console.error('Error starting DM:', error)
      alert('An error occurred. Please try again.')
    }
  }

  return (
    <>
      <div className="w-64 h-full bg-gray-900 border-r border-gray-800 flex flex-col relative z-10 overflow-hidden">
        {/* Workspace Header */}
        <div className="p-4 border-b border-gray-800">
          <button className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-800 rounded-lg transition duration-200">
            <div>
              <h2 className="text-white font-semibold">My Workspace</h2>
              <p className="text-gray-400 text-xs">Team Chat</p>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Channels Section */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-4">
            {/* Main Channels Header */}
            <div className="w-full flex items-center justify-between text-gray-400 hover:text-white mb-2 group">
              <button 
                onClick={() => setShowChannelsSection(!showChannelsSection)}
                className="flex items-center gap-2 flex-1"
              >
                <svg 
                  className={`w-4 h-4 transition-transform ${showChannelsSection ? 'rotate-0' : '-rotate-90'}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                <span className="text-sm font-semibold">Channels</span>
              </button>
              <button
                onClick={openChannelModal}
                className="p-1 hover:bg-gray-800 rounded transition duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            {showChannelsSection && (
              <div className="ml-3 border-l-2 border-gray-700 pl-3 space-y-4">
                {/* Your Channels */}
                <div>
                  <div className="text-gray-500 text-xs font-semibold uppercase mb-2">Your Channels</div>
                  <div className="space-y-1">
                    {loadingChannels ? (
                      <div className="px-3 py-2 text-gray-500 text-sm">Loading...</div>
                    ) : createdChannels.length > 0 ? (
                      <>
                        {createdChannels.slice(0, showAllCreated ? createdChannels.length : 2).map((channel) => (
                          <button
                            key={channel._id}
                            onClick={() => handleChannelClick(channel._id)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition duration-200 ${
                              activeChannel === channel._id
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-300 hover:bg-gray-800'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">#</span>
                              <span className="text-sm truncate">{channel.name}</span>
                            </div>
                            {channelUnreadCounts[channel._id] > 0 && (
                              <div className="bg-green-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                                {channelUnreadCounts[channel._id] > 9 ? '9+' : channelUnreadCounts[channel._id]}
                              </div>
                            )}
                          </button>
                        ))}
                        {createdChannels.length > 2 && (
                          <button
                            onClick={() => setShowAllCreated(!showAllCreated)}
                            className="w-full px-3 py-2 text-gray-400 hover:text-white text-sm text-left transition duration-200"
                          >
                            {showAllCreated ? '← Show less' : `→ Show ${createdChannels.length - 2} more`}
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="px-3 py-2 text-gray-500 text-sm">No channels yet</div>
                    )}
                  </div>
                </div>

                {/* Joined Channels */}
                <div>
                  <div className="text-gray-500 text-xs font-semibold uppercase mb-2">Joined</div>
                  <div className="space-y-1">
                    {joinedChannels.length > 0 ? (
                      <>
                        {joinedChannels.slice(0, showAllJoined ? joinedChannels.length : 2).map((channel) => (
                          <button
                            key={channel._id}
                            onClick={() => handleChannelClick(channel._id)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition duration-200 ${
                              activeChannel === channel._id
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-300 hover:bg-gray-800'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">#</span>
                              <span className="text-sm truncate">{channel.name}</span>
                            </div>
                            {channelUnreadCounts[channel._id] > 0 && (
                              <div className="bg-green-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                                {channelUnreadCounts[channel._id] > 9 ? '9+' : channelUnreadCounts[channel._id]}
                              </div>
                            )}
                          </button>
                        ))}
                        {joinedChannels.length > 2 && (
                          <button
                            onClick={() => setShowAllJoined(!showAllJoined)}
                            className="w-full px-3 py-2 text-gray-400 hover:text-white text-sm text-left transition duration-200"
                          >
                            {showAllJoined ? '← Show less' : `→ Show ${joinedChannels.length - 2} more`}
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="px-3 py-2 text-gray-500 text-sm">No joined channels</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Direct Messages Section */}
          <div className="p-4 border-t border-gray-800">
            <div className="w-full flex items-center justify-between text-gray-400 hover:text-white mb-2 group">
              <button className="flex items-center gap-2 flex-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                <span className="text-sm font-semibold">Direct Messages</span>
              </button>
              <button
                onClick={openDMModal}
                className="p-1 hover:bg-gray-800 rounded transition duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            <div className="space-y-1">
              {loadingChannels ? (
                <div className="px-3 py-2 text-gray-500 text-sm">Loading...</div>
              ) : directMessages.length > 0 ? (
                <>
                  {directMessages.slice(0, showAllDMs ? directMessages.length : 2).map((dm) => (
                    <button
                      key={dm._id}
                      onClick={async () => handleOpenDm(dm._id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition duration-200 ${
                        activeChannel === dm._id
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                          {dm.user?.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        {dm.unreadCount > 0 && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs font-bold">{dm.unreadCount > 9 ? '9+' : dm.unreadCount}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-sm font-medium truncate">{dm.user?.name || 'Unknown User'}</span>
                          {dm.lastMessage && (
                            <span className="text-xs text-gray-500 ml-2 shrink-0">
                              {new Date(dm.lastMessage.createdAt).toLocaleTimeString('en-US', { 
                                hour: 'numeric', 
                                minute: '2-digit',
                                hour12: true 
                              })}
                            </span>
                          )}
                        </div>
                        {dm.lastMessage && (
                          <div className="flex items-center gap-1">
                            {dm.lastMessage.senderId === dm.user?._id ? null : (
                              <div className="shrink-0">
                                {dm.lastMessage.isRead ? (
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
                            <span className={`text-xs truncate ${dm.unreadCount > 0 ? 'font-semibold text-white' : 'text-gray-500'}`}>
                              {dm.lastMessage.content}
                            </span>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                  {directMessages.length > 2 && (
                    <button
                      onClick={() => setShowAllDMs(!showAllDMs)}
                      className="w-full px-3 py-2 text-gray-400 hover:text-white text-sm text-left transition duration-200"
                    >
                      {showAllDMs ? '← Show less' : `→ Show ${directMessages.length - 2} more`}
                    </button>
                  )}
                </>
              ) : (
                <div className="px-3 py-2 text-gray-500 text-sm">No direct messages</div>
              )}
            </div>
          </div>
        </div>

        {/* Profile Section - Visible on Mobile */}
        <div className="p-4 border-t border-gray-800 md:hidden">
          <button
            onClick={() => router.push('/profile')}
            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-800 rounded-lg transition duration-200"
          >
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
              {session?.user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 text-left">
              <p className="text-white font-medium text-sm truncate">{session?.user?.name || 'User'}</p>
              <p className="text-gray-400 text-xs truncate">{session?.user?.email}</p>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={() => {
              if (confirm('Are you sure you want to sign out?')) {
                window.location.href = '/api/auth/signout'
              }
            }}
            className="w-full flex items-center gap-3 px-3 py-2 mt-2 text-red-400 hover:bg-gray-800 rounded-lg transition duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Channel Search Modal */}
      {showChannelModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto modal-scrollbar">
          <div className="flex min-h-full items-start justify-center py-8">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={closeChannelModal}
            ></div>
            <div className="relative bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg mx-4 shadow-2xl my-auto">
              <div className="p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Browse Channels</h2>

                <div className="relative mb-4">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search channels..."
                    className="w-full px-4 py-3 pl-10 bg-gray-800 text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2 mb-4">
                  {searchingChannels ? (
                    <div className="text-center py-8">
                      <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-gray-400 text-sm mt-2">Searching...</p>
                    </div>
                  ) : searchedChannels.length > 0 ? (
                    searchedChannels.map((channel) => (
                      <div key={channel._id} className="flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition duration-200">
                        <div className="flex items-center gap-3">
                          <span className="text-xl text-gray-400">#</span>
                          <div>
                            <p className="text-white font-medium">{channel.name}</p>
                            <p className="text-gray-400 text-xs">{channel.description || 'No description'}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleJoinChannel(channel._id)}
                          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition duration-200"
                        >
                          Join
                        </button>
                      </div>
                    ))
                  ) : searchQuery.trim() ? (
                    <p className="text-gray-500 text-sm text-center py-8">No channels found</p>
                  ) : (
                    <p className="text-gray-500 text-sm text-center py-8">Start typing to search channels</p>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-700">
                  <p className="text-gray-400 text-sm text-center mb-3">or</p>
                  <button
                    onClick={openCreateChannelModal}
                    className="w-full py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition duration-200 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Create Your Own Channel</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Direct Message Modal */}
      {showDMModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto modal-scrollbar">
          <div className="flex min-h-full items-start justify-center py-8">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={closeDMModal}
            ></div>
            <div className="relative bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg mx-4 shadow-2xl my-auto">
              <div className="p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Start Direct Message</h2>

                <div className="relative mb-4">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search people by name..."
                    className="w-full px-4 py-3 pl-10 bg-gray-800 text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2">
                  {searchingUsers ? (
                    <div className="text-center py-8">
                      <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-gray-400 text-sm mt-2">Searching...</p>
                    </div>
                  ) : searchedUsers.length > 0 ? (
                    searchedUsers.map((user) => (
                      <div key={user._id} className="flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition duration-200">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                            {user.name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div className="text-left">
                            <p className="text-white font-medium">{user.name}</p>
                            <p className="text-gray-400 text-xs">{user.email}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleStartDM(user._id)}
                          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition duration-200"
                        >
                          Message
                        </button>
                      </div>
                    ))
                  ) : searchQuery.trim() ? (
                    <p className="text-gray-500 text-sm text-center py-8">No users found</p>
                  ) : (
                    <p className="text-gray-500 text-sm text-center py-8">Start typing to search users</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Channel Modal */}
      {showCreateChannelModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto modal-scrollbar">
          <div className="flex min-h-full items-start justify-center py-8">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={closeCreateChannelModal}
            ></div>
            <div className="relative bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg mx-4 shadow-2xl my-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-white">Create New Channel</h2>
                  <button
                    onClick={closeCreateChannelModal}
                    className="text-gray-400 hover:text-white transition duration-200"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleCreateChannel} className="space-y-5">
                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm flex items-start gap-2">
                      <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{error}</span>
                    </div>
                  )}

                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                      Channel Name
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg">#</span>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={channelForm.name}
                        onChange={handleFormChange}
                        placeholder="e.g. project-updates or Project Updates"
                        required
                        className="w-full px-4 py-3 pl-8 bg-gray-800 text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <p className="text-gray-500 text-xs mt-1">Spaces will be automatically converted to hyphens</p>
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={channelForm.description}
                      onChange={handleFormChange}
                      placeholder="What's this channel about?"
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-800 text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Visibility
                    </label>
                    <div className="space-y-3">
                      <label className="flex items-start p-4 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800 transition duration-200 border-2 border-transparent has-[:checked]:border-blue-500">
                        <input
                          type="radio"
                          name="visibility"
                          value="public"
                          checked={channelForm.visibility === 'public'}
                          onChange={handleFormChange}
                          className="mt-1 mr-3"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-white font-medium">Public</span>
                          </div>
                          <p className="text-gray-400 text-sm">Anyone in the workspace can join</p>
                        </div>
                      </label>

                      <label className="flex items-start p-4 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800 transition duration-200 border-2 border-transparent has-[:checked]:border-blue-500">
                        <input
                          type="radio"
                          name="visibility"
                          value="private"
                          checked={channelForm.visibility === 'private'}
                          onChange={handleFormChange}
                          className="mt-1 mr-3"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            <span className="text-white font-medium">Private</span>
                          </div>
                          <p className="text-gray-400 text-sm">Only invited members can join</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={closeCreateChannelModal}
                      disabled={loading}
                      className="flex-1 px-4 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Creating...' : 'Create Channel'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ChannelSidebar