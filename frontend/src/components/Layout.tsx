import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  LayoutDashboard,
  Workflow,
  Box,
  ScrollText,
  LogOut,
  Server,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { server, auth } from '@/lib/api'

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/machines', label: 'Machines', icon: Workflow },
  { path: '/instances', label: 'Instances', icon: Box },
  { path: '/wal', label: 'WAL', icon: ScrollText },
]

export function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    return saved === 'true'
  })

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }

  const { data: authData, isLoading: authLoading, error: authError } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => auth.me(),
    retry: false,
  })

  const { data: serverInfo } = useQuery({
    queryKey: ['server-info'],
    queryFn: () => server.info(),
    refetchInterval: 30000,
    enabled: authData?.logged_in === true,
  })

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && (!authData?.logged_in || authError)) {
      navigate('/login')
    }
  }, [authData, authLoading, authError, navigate])

  const handleLogout = async () => {
    try {
      await auth.logout()
      queryClient.clear()
      navigate('/login')
    } catch {
      // Still navigate to login on error
      navigate('/login')
    }
  }

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted">Loading...</div>
      </div>
    )
  }

  // Don't render if not authenticated
  if (!authData?.logged_in) {
    return null
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={`${
          collapsed ? 'w-16' : 'w-64'
        } bg-surface border-r border-border flex flex-col transition-all duration-200`}
      >
        {/* Logo */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Server className="w-6 h-6 text-primary flex-shrink-0" />
            {!collapsed && <span className="text-lg font-semibold">rstmdb Studio</span>}
          </Link>
          <button
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1 text-muted hover:text-foreground rounded transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path)
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      collapsed ? 'justify-center' : ''
                    } ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted hover:text-foreground hover:bg-surface'
                    }`}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Server Status */}
        <div className="p-2 border-t border-border">
          {collapsed ? (
            <div
              className={`w-3 h-3 rounded-full mx-auto ${
                serverInfo?.rstmdb.connected ? 'bg-secondary' : 'bg-destructive'
              }`}
              title={serverInfo?.rstmdb.connected ? 'Connected' : 'Disconnected'}
            />
          ) : (
            <div className="text-xs text-muted px-2">
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={`w-2 h-2 rounded-full ${
                    serverInfo?.rstmdb.connected ? 'bg-secondary' : 'bg-destructive'
                  }`}
                />
                <span>
                  {serverInfo?.rstmdb.connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              {serverInfo && (
                <div className="text-muted/70">
                  {serverInfo.rstmdb.server_name} v{serverInfo.rstmdb.server_version}
                </div>
              )}
            </div>
          )}
        </div>

        {/* User */}
        <div className="p-2 border-t border-border">
          {collapsed ? (
            <button
              onClick={handleLogout}
              title="Logout"
              className="flex items-center justify-center w-full p-2 text-muted hover:text-foreground rounded-lg"
            >
              <LogOut className="w-5 h-5" />
            </button>
          ) : (
            <div className="px-2">
              <div className="text-sm text-muted mb-2">{authData.username}</div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm text-muted hover:text-foreground w-full"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>

        {/* Studio Version */}
        {serverInfo && !collapsed && (
          <div className="px-4 py-2 text-xs text-muted/50">
            Studio v{serverInfo.studio_version}
          </div>
        )}

      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-background">
        <Outlet />
      </main>
    </div>
  )
}
