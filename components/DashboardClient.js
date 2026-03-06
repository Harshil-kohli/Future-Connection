"use client"
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import ChannelSidebar from './ChannelSidebar'
import ChatInterface from './ChatInterface'

export default function DashboardClient() {
  const searchParams = useSearchParams()
  const channelId = searchParams.get('channel')
  const dmId = searchParams.get('dm')
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)

  return (
    <>
      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setShowMobileSidebar(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div className={`
        fixed top-0 left-0 h-screen w-64 bg-gray-900 z-50 transform transition-transform duration-300 md:hidden overflow-hidden
        ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-gray-800 shrink-0">
            <h2 className="text-white font-semibold">Menu</h2>
            <button
              onClick={() => setShowMobileSidebar(false)}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChannelSidebar onNavigate={() => setShowMobileSidebar(false)} />
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="ml-0 md:ml-16 flex-1 flex h-full overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden md:block h-full">
          <ChannelSidebar />
        </div>
        
        {/* Chat Interface with Mobile Header */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-3 p-3 bg-gray-900 border-b border-gray-800 shrink-0">
            <button
              onClick={() => setShowMobileSidebar(true)}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-white font-semibold">Chat</span>
          </div>

          <div className="flex-1 overflow-hidden">
            <ChatInterface channelId={channelId} dmId={dmId} />
          </div>
        </div>
      </div>
    </>
  )
}
