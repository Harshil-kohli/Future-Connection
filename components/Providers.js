"use client"
import { SessionProvider } from "next-auth/react"
import { SocketProvider } from "@/lib/SocketContext"

export default function Providers({ children }) {
  return (
    <SessionProvider>
      <SocketProvider>
        {children}
      </SocketProvider>
    </SessionProvider>
  )
}
