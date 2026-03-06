import Sidebar from './Sidebar'
import Navbar from './Navbar'

const DashboardLayout = ({ children, session, title }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <Sidebar session={session} />
      <div className="ml-64">
        <Navbar title={title} />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout
