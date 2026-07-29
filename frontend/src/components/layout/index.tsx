import React from 'react';
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard, Package, Truck, RotateCcw,
  Building2, FileSpreadsheet, Users, Settings,
  History, LogOut, ShieldCheck, ChevronRight,
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
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, color: 'text-indigo-600' },
    { label: 'Inventory', path: '/inventory', icon: Package, color: 'text-blue-600' },
    { label: 'Dispatch', path: '/dispatch', icon: Truck, color: 'text-rose-600' },
    { label: 'Pickup & OEM', path: '/pickup', icon: RotateCcw, color: 'text-emerald-600' },
    { label: 'Site Master', path: '/sites', icon: Building2, color: 'text-cyan-600' },
    { label: 'Reports', path: '/reports', icon: FileSpreadsheet, color: 'text-amber-600' },
    { label: 'Users', path: '/users', icon: Users, color: 'text-pink-600' },
    { label: 'Activity Log', path: '/activity', icon: History, color: 'text-purple-600' },
    { label: 'Settings', path: '/settings', icon: Settings, color: 'text-slate-600' },
  ];

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  return (
    <aside className="w-[240px] flex flex-col h-screen sticky top-0 z-50 shrink-0 bg-[#f8fafc] border-r border-[#e2e8f0]">
      {/* Brand — Substantially Larger Proactive Logo Box (~90px x 90px) */}
      <div className="px-4 pt-6 pb-5 border-b border-[#e2e8f0]">
        <div className="flex flex-col items-center gap-2.5 text-center">
          {/* Square Logo Box (~90px x 90px) */}
          <div
            className="w-[90px] h-[90px] aspect-square bg-white rounded-2xl flex items-center justify-center p-3 shadow-md mx-auto transition-transform hover:scale-102"
            style={{ border: '1.5px solid #334155' }}
          >
            <img
              src={pdsLogo}
              alt="Proactive Data Systems"
              className="w-full h-full object-contain block"
            />
          </div>
          {/* App subtitle */}
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm" />
            <p className="text-[11px] text-slate-600 tracking-wide font-bold">Spare IMS · Live</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all group ${
                  isActive
                    ? 'bg-[#4f46e5] text-white shadow-md shadow-indigo-500/25 border-l-4 border-l-[#2563eb]'
                    : 'text-slate-700 hover:bg-slate-200/70 hover:text-slate-900 border-l-4 border-l-transparent'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`shrink-0 w-4 h-4 transition-colors ${isActive ? 'text-white' : item.color}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className={`truncate ${isActive ? 'text-white font-bold' : 'text-slate-700 font-semibold'}`}>{item.label}</span>
                  {isActive && (
                    <ChevronRight className="w-3.5 h-3.5 text-white ml-auto shrink-0 opacity-90" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="px-3 pb-4 pt-3 border-t border-[#e2e8f0]">
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-white border border-[#e2e8f0] shadow-sm">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white shadow-sm"
            style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate">{user?.name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <ShieldCheck className="w-2.5 h-2.5 text-indigo-600" />
              <span className="text-[10px] text-slate-500 font-semibold capitalize truncate">
                {user?.role?.replace(/_/g, ' ').toLowerCase()}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all shrink-0"
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

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <header className="h-14 px-6 flex items-center justify-between sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#e2e8f0]">
      {/* Page Title */}
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-5 rounded-full bg-indigo-600" />
        <h2 className="text-base font-black text-slate-900 tracking-tight">{title}</h2>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Live pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-700">
          <span className="pulse-dot" style={{ width: 6, height: 6 }} />
          Live System
        </div>

        {/* Date/Time (Date on top, Time on bottom) */}
        <div className="hidden md:flex flex-col items-end">
          <span className="text-xs font-bold text-slate-800">{dateStr}</span>
          <span className="text-[10px] text-slate-500 font-mono font-semibold">{timeStr}</span>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-slate-200" />

        {/* User avatar */}
        <Link to="/users" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm bg-indigo-600">
            {user?.name?.[0] || 'U'}
          </div>
          <span className="hidden md:block text-xs font-bold text-slate-800 max-w-[110px] truncate">{user?.name}</span>
        </Link>
      </div>
    </header>
  );
};

export const Layout: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  return (
    <div className="flex min-h-screen bg-white" style={{ backgroundColor: '#ffffff' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        <Header title={title} />
        <main className="flex-1 p-5 md:p-6 overflow-y-auto page-enter bg-white">
          {children}
        </main>
      </div>
    </div>
  );
};
