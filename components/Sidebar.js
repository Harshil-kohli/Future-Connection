"use client"
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'

const Sidebar = ({ session }) => {
  const router = useRouter()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const timeoutRef = useRef(null)

  const hideDelay = 400 // ms

  const menuItems = [
    { name: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', path: '/dashboard' },
    { name: 'Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', path: '/dashboard/analytics' },
    { name: 'Projects', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z', path: '/dashboard/projects' },
    { name: 'Tasks', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', path: '/dashboard/tasks' },
    { name: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', path: '/dashboard/settings' },
  ]

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/login' })
  }

  const clearHideTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  const scheduleHide = () => {
    clearHideTimeout()
    timeoutRef.current = setTimeout(() => {
      setShowProfileMenu(false)
      timeoutRef.current = null
    }, hideDelay)
  }

  // ensure cleanup on unmount
  useEffect(() => {
    return () => clearHideTimeout()
  }, [])

  return (
    <div className="w-16 h-screen bg-gray-900 border-r border-gray-800 flex-col fixed left-0 top-0 z-50 overflow-visible hidden md:flex">
      {/* Logo */}
      <div className="h-16 flex items-center justify-center border-b border-gray-800">
        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
          M
        </div>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 py-4 space-y-2 overflow-y-auto overflow-x-hidden scrollbar-hide">
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => router.push(item.path)}
            className="w-full flex items-center justify-center p-3 text-gray-400 hover:bg-gray-800 hover:text-white transition duration-200 group relative"
            title={item.name}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
            </svg>
            {/* Tooltip */}
            <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity duration-200">
              {item.name}
            </span>
          </button>
        ))}
      </nav>

      {/* Profile Section */}
      {/* Note: handlers are attached to wrapper, button and dropdown so hovering either keeps menu open */}
      <div className="p-2 border-t border-gray-800 relative">
        <div
          onMouseEnter={() => { clearHideTimeout(); setShowProfileMenu(true) }}
          onMouseLeave={scheduleHide}
          className="w-full flex items-center justify-center"
        >
          <button
            aria-haspopup="true"
            aria-expanded={showProfileMenu}
            onClick={() => setShowProfileMenu((s) => !s)}
            onMouseEnter={() => { clearHideTimeout(); setShowProfileMenu(true) }}
            onMouseLeave={scheduleHide}
            className="w-full flex items-center justify-center p-2 hover:bg-gray-800 rounded-lg transition duration-200"
          >
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
              {session?.user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
          </button>
        </div>

        {/* Profile Dropdown */}
        <div
          // positioned to the right of the sidebar
          className={`absolute bottom-2 left-full ml-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl z-[9999] transform origin-left
            ${showProfileMenu ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}
          onMouseEnter={() => { clearHideTimeout(); setShowProfileMenu(true) }}
          onMouseLeave={scheduleHide}
          style={{ transitionProperty: 'opacity, transform', transitionDuration: `${hideDelay}ms` }}
          role="menu"
          aria-hidden={!showProfileMenu}
        >
          <div className="px-4 py-3 border-b border-gray-700">
            <p className="text-white font-medium text-sm truncate">{session?.user?.name || 'User'}</p>
            <p className="text-gray-400 text-xs truncate">{session?.user?.email}</p>
          </div>

          <button
            onClick={() => router.push('/profile')}
            className="w-full px-4 py-3 text-left text-gray-300 hover:bg-gray-700 hover:text-white transition duration-200 flex items-center gap-3"
            role="menuitem"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>View Profile</span>
          </button>

          <button
            onClick={handleSignOut}
            className="w-full px-4 py-3 text-left text-red-400 hover:bg-gray-700 hover:text-red-300 transition duration-200 flex items-center gap-3"
            role="menuitem"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default Sidebar