'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

interface NavItem {
  label: string;
  href: string;
}

const navItems: Record<string, NavItem[]> = {
  ADMIN: [
    { label: 'Dashboard', href: '/dashboard/admin' },
    { label: 'Users', href: '/users' },
    { label: 'Teams', href: '/teams' },
    { label: 'Reports', href: '/reports' },
    { label: 'Profile', href: '/profile' },
  ],
  MANAGER: [
    { label: 'Dashboard', href: '/dashboard/manager' },
    { label: 'My Team', href: '/teams/my-team' },
    { label: 'Tasks', href: '/tasks' },
    { label: 'Email', href: '/email-workspace' },
    { label: 'Reports', href: '/reports' },
    { label: 'Profile', href: '/profile' },
  ],
  REP: [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'My Tasks', href: '/tasks' },
    { label: 'Email', href: '/email-workspace' },
    { label: 'Profile', href: '/profile' },
  ],
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const items = user ? navItems[user.role] || [] : [];

  return (
    <aside
      className={`flex flex-col bg-white border-r border-border h-screen transition-all duration-200 flex-shrink-0 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="flex items-center justify-between h-16 px-4 border-b border-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Image src="/RelantoLogo.svg" alt="Relanto Logo" width={32} height={32} />
            <span className="text-lg font-semibold text-foreground">EngageSync</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-muted transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={collapsed ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 19l-7-7 7-7m8 14l-7-7 7-7"} />
          </svg>
        </button>
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-light text-primary'
                  : 'text-muted hover:bg-gray-50 hover:text-foreground'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <span className={`flex-shrink-0 w-2 h-2 rounded-full ${isActive ? 'bg-primary' : 'bg-border'}`} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {user && (
        <div className="border-t border-border">
          <div className={`flex items-center gap-3 p-4 ${collapsed ? 'justify-center' : ''}`}>
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-light text-primary flex items-center justify-center text-sm font-semibold">
              {user.first_name?.[0]}{user.last_name?.[0]}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user.first_name} {user.last_name}
                </p>
                <p className="text-xs text-muted truncate">{user.role.toLowerCase()}</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <div className="px-4 pb-4">
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-muted hover:text-danger hover:bg-red-50 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
