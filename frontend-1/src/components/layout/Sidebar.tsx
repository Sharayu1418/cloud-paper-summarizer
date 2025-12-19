'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import clsx from 'clsx';
import { useState } from 'react';
import {
  BookOpen,
  Library,
  Search,
  Settings,
  ChevronRight,
  ChevronLeft,
  LogOut,
  User,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { logout } from '@/lib/auth';

const navigation = [
  {
    name: 'Library',
    href: '/library',
    icon: Library,
    description: 'Your uploaded papers',
  },
  {
    name: 'Study Sessions',
    href: '/sessions',
    icon: BookOpen,
    description: 'Organize & chat with papers',
  },
  {
    name: 'Search',
    href: '/search',
    icon: Search,
    description: 'Find new research',
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, isAuthenticated } = useAuth();

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  // Determine which step is active based on current route
  const getStepStatus = (stepNumber: number) => {
    if (pathname?.startsWith('/library')) {
      return stepNumber === 1 ? 'active' : stepNumber < 1 ? 'completed' : 'pending';
    }
    if (pathname?.startsWith('/sessions') && !pathname?.includes('/sessions/')) {
      return stepNumber === 2 ? 'active' : stepNumber < 2 ? 'completed' : 'pending';
    }
    if (pathname?.includes('/sessions/')) {
      return stepNumber === 3 ? 'active' : 'completed';
    }
    return 'pending';
  };

  return (
    <aside
      className={clsx(
        'h-screen bg-white border-r border-[var(--color-parchment)] flex flex-col transition-all duration-300 relative',
        isCollapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute top-6 -right-3 w-6 h-6 bg-white border border-[var(--color-parchment)] rounded-full flex items-center justify-center text-[var(--color-stone)] hover:text-[var(--color-ink)] hover:border-[var(--color-forest)] transition-colors shadow-md z-50"
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Logo */}
      <div className="p-6 border-b border-[var(--color-parchment)]">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--color-forest)] flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <h1 className="font-serif font-bold text-lg text-[var(--color-ink)] whitespace-nowrap">
                Scholar
              </h1>
              <p className="text-xs text-[var(--color-stone)] whitespace-nowrap">
                Research Assistant
              </p>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group relative',
                isActive
                  ? 'bg-[var(--color-forest)] text-white'
                  : 'hover:bg-[var(--color-parchment)]'
              )}
              title={isCollapsed ? item.name : undefined}
            >
              <Icon 
                size={20} 
                className={clsx(
                  'flex-shrink-0',
                  isActive
                    ? 'text-white'
                    : 'text-[var(--color-stone)] group-hover:text-[var(--color-slate)]'
                )}
              />
              {!isCollapsed && (
                <>
                  <div className="flex-1 overflow-hidden">
                    <span 
                      className={clsx(
                        'font-medium',
                        isActive
                          ? 'text-white'
                          : 'text-[var(--color-stone)] group-hover:text-[var(--color-slate)]'
                      )}
                    >
                      {item.name}
                    </span>
                    <p
                      className={clsx(
                        'text-xs mt-0.5',
                        isActive
                          ? 'text-white/70'
                          : 'text-[var(--color-stone)] group-hover:text-[var(--color-slate)]'
                      )}
                    >
                      {item.description}
                    </p>
                  </div>
                  <ChevronRight
                    size={16}
                    className={clsx(
                      'opacity-0 -translate-x-2 transition-all duration-200 flex-shrink-0',
                      isActive
                        ? 'opacity-100 translate-x-0'
                        : 'group-hover:opacity-50 group-hover:translate-x-0'
                    )}
                  />
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Getting Started Guide */}
      {!isCollapsed && (
        <div className="p-4 border-t border-[var(--color-parchment)]">
          <div className="p-4 rounded-lg bg-[var(--color-cream)]">
            <h3 className="font-medium text-sm text-[var(--color-ink)] mb-2">
              Getting Started
            </h3>
            <ol className="space-y-2 text-xs text-[var(--color-stone)]">
              <li className="flex items-start gap-2">
                <span className={clsx(
                  'w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5',
                  getStepStatus(1) === 'active' 
                    ? 'bg-[var(--color-forest)] text-white' 
                    : getStepStatus(1) === 'completed'
                    ? 'bg-[var(--color-forest)] text-white'
                    : 'bg-[var(--color-sand)] text-[var(--color-slate)]'
                )}>
                  1
                </span>
                Upload papers to your Library
              </li>
              <li className="flex items-start gap-2">
                <span className={clsx(
                  'w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5',
                  getStepStatus(2) === 'active' 
                    ? 'bg-[var(--color-forest)] text-white' 
                    : getStepStatus(2) === 'completed'
                    ? 'bg-[var(--color-forest)] text-white'
                    : 'bg-[var(--color-sand)] text-[var(--color-slate)]'
                )}>
                  2
                </span>
                Create a Study Session
              </li>
              <li className="flex items-start gap-2">
                <span className={clsx(
                  'w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5',
                  getStepStatus(3) === 'active' 
                    ? 'bg-[var(--color-forest)] text-white' 
                    : getStepStatus(3) === 'completed'
                    ? 'bg-[var(--color-forest)] text-white'
                    : 'bg-[var(--color-sand)] text-[var(--color-slate)]'
                )}>
                  3
                </span>
                Ask questions about your papers
              </li>
            </ol>
          </div>
        </div>
      )}

      {/* User Info & Logout */}
      {isAuthenticated && user && (
        <div className="p-4 border-t border-[var(--color-parchment)]">
          {!isCollapsed ? (
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-[var(--color-forest)]/10 flex items-center justify-center text-[var(--color-forest)]">
                <User size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-ink)] truncate">
                  {user.name || user.email}
                </p>
                <p className="text-xs text-[var(--color-stone)] truncate">
                  {user.email}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-[var(--color-stone)] hover:bg-[var(--color-parchment)] hover:text-[var(--color-error)] transition-colors"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center p-2 rounded-lg text-[var(--color-stone)] hover:bg-[var(--color-parchment)] hover:text-[var(--color-error)] transition-colors"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      )}

      {/* Settings */}
      <div className="p-4 border-t border-[var(--color-parchment)]">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-[var(--color-stone)] hover:bg-[var(--color-parchment)] hover:text-[var(--color-ink)] transition-colors"
          title={isCollapsed ? 'Settings' : undefined}
        >
          <Settings size={18} className="flex-shrink-0" />
          {!isCollapsed && <span className="text-sm">Settings</span>}
        </Link>
      </div>
    </aside>
  );
}
