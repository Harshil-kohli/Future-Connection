import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/authOptions'
import LoginUI from '@/components/LoginUI'

export default async function LoginPage() {
  const session = await getServerSession(authOptions)
  
  // If user is already logged in, redirect to dashboard
  if (session) {
    redirect('/dashboard')
  }

  return <LoginUI />
}
