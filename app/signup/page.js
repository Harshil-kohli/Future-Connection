import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/authOptions'
import SignupUI from '@/components/SignupUI'

export default async function SignupPage() {
  const session = await getServerSession(authOptions)
  
  // If user is already logged in, redirect to dashboard
  if (session) {
    redirect('/dashboard')
  }

  return <SignupUI />
}
