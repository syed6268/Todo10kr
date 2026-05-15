import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import MobileNav from './MobileNav.jsx'

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-700 via-violet-700 to-purple-900">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex w-full flex-col">
          <MobileNav />
          <main className="flex-1 px-4 py-8 sm:px-6 lg:px-10">
            <div className="mx-auto max-w-5xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
