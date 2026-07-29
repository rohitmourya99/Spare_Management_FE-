import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, Truck, RotateCcw,
  Building2, FileSpreadsheet, Users, Settings,
  History, LogOut, ShieldCheck, ChevronRight,
  Boxes, Bell, Search,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import pdsLogo from '../../assets/pds-logo.png';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, color: 'text-indigo-400' },
    { label: 'Inventory', path: '/inventory', icon: Package, color: 'text-blue-400' },
    { label: 'Dispatch', path: '/dispatch', icon: Truck, color: 'text-rose-400' },
    { label: 'Pickup & OEM', path: '/pickup', icon: RotateCcw, color: 'text-emerald-400' },
    { label: 'Site Master', path: '/sites', icon: Building2, color: 'text-cyan-400' },
    { label: 'Reports', path: '/reports', icon: FileSpreadsheet, color: 'text-amber-400' },
    { label: 'Activity Log', path: '/activity', icon: History, color: 'text-purple-400' },
  ];

  if (user?.role === 'SUPER_ADMIN') {
    navItems.push({ label: 'Users', path: '/users', icon: Users, color: 'text-pink-400' });
  }
  navItems.push({ label: 'Settings', path: '/settings', icon: Settings, color: 'text-slate-400' });

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  return (
    <aside className="w-[220px] flex flex-col h-screen sticky top-0 z-50" style={{
      background: 'linear-gradient(180deg, rgba(8,10,20,0.98) 0%, rgba(10,13,26,0.98) 100%)',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      backdropFilter: 'blur(20px)',
    }}>
      {/* Brand */}
      <div className="px-4 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex flex-col items-center gap-2">
          {/* Proactive Logo — white card so original colors stay bright */}
          <div className="w-full flex items-center justify-center px-3 py-2 rounded-2xl"
            style={{
              background: '#ffffff',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.15), 0 4px 20px rgba(0,0,0,0.4)',
            }}>
            <img
              src={pdsLogo}
              alt="Proactive Data Systems"
              className="w-auto object-contain"
              style={{ height: '40px', maxWidth: '175px', display: 'block' }}
            />
          </div>
          {/* App subtitle */}
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#10b981' }} />
            <p className="text-[10px] text-slate-400 tracking-wide font-medium">Spare IMS · Live</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                  isActive ? 'nav-item-active' : 'nav-item-inactive'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`shrink-0 w-4 h-4 transition-colors ${isActive ? 'text-indigo-300' : item.color}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className={`truncate ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>{item.label}</span>
                  {isActive && (
                    <ChevronRight className="w-3 h-3 text-indigo-400 ml-auto shrink-0 opacity-60" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="px-3 pb-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl" style={{
          background: 'rgba(99,102,241,0.06)',
          border: '1px solid rgba(99,102,241,0.12)',
        }}>
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 2px 8px rgba(99,102,241,0.35)' }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">{user?.name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <ShieldCheck className="w-2.5 h-2.5 text-indigo-400" />
              <span className="text-[10px] text-slate-500 capitalize truncate">
                {user?.role?.replace(/_/g, ' ').toLowerCase()}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export const Header: React.FC<{ title: string }> = ({ title }) => {
  const { user } = useAuthStore();
  const location = useLocation();

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <header className="h-14 px-6 flex items-center justify-between sticky top-0 z-40"
      style={{
        background: 'rgba(8,12,20,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
      {/* Page Title */}
      <div className="flex items-center gap-3">
        <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg,#6366f1,#8b5cf6)' }} />
        <h2 className="text-base font-bold text-white tracking-tight">{title}</h2>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Live pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.2)',
            color: '#34d399',
          }}>
          <span className="pulse-dot" style={{ width: 6, height: 6 }} />
          Live
        </div>

        {/* Date/Time (Date on top, Time on bottom) */}
        <div className="hidden md:flex flex-col items-end">
          <span className="text-xs font-semibold text-slate-200">{dateStr}</span>
          <span className="text-[10px] text-slate-400 font-mono">{timeStr}</span>
        </div>

        {/* Divider */}
        <div className="w-px h-6" style={{ background: 'rgba(255,255,255,0.07)' }} />

        {/* User avatar */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
            {user?.name?.[0] || 'U'}
          </div>
          <span className="hidden md:block text-xs font-medium text-slate-300 max-w-[100px] truncate">{user?.name}</span>
        </div>
      </div>
    </header>
  );
};

export const Layout: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  return (
    <div className="flex min-h-screen app-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title={title} />
        <main className="flex-1 p-5 md:p-6 overflow-y-auto page-enter">
          {children}
        </main>
      </div>
    </div>
  );
};
