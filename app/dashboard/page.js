import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import Sidebar from '@/components/Sidebar'
import DashboardClient from '@/components/DashboardClient'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  return (
    <div className="h-screen w-full flex overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <Sidebar session={session} />
      <DashboardClient />
    </div>
  )
}
