import { NextResponse } from 'next/server'

export async function GET() {
  return new NextResponse('Socket.IO server is running', { status: 200 })
}
