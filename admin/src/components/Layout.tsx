import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, Film, Flag, MessageSquare, Settings, LogOut, BarChart2 } from 'lucide-react';
import { useAuth } from '../stores/auth';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/posts', label: 'Posts', icon: Film },
  { to: '/reports', label: 'Reports', icon: Flag },
  { to: '/tickets', label: 'Support', icon: MessageSquare },
];

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
        <div className="p-5 border-b border-gray-800">
          <h1 className="text-sm font-semibold tracking-widest uppercase text-gray-400">TM Admin</h1>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-800">
          <div className="px-3 py-2 text-xs text-gray-500 truncate">{user?.email}</div>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white w-full transition-colors"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto bg-gray-950">
        <Outlet />
      </main>
    </div>
  );
}
