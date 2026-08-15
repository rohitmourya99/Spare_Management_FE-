import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard, Package, Truck, RotateCcw,
  Building2, FileSpreadsheet, Users, Settings,
  History, LogOut, ShieldCheck, ChevronRight, Calendar, Clock,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useOrganization } from '../../context/OrganizationContext';
import pdsLogo from '../../assets/pds-logo.png';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const role = user?.role || 'ENGINEER';

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, color: 'text-indigo-600', roles: ['SUPER_ADMIN', 'INVENTORY_ADMIN', 'ENGINEER', 'READ_ONLY'] },
    { label: 'Stock List', path: '/stock-list', icon: Package, color: 'text-blue-600', roles: ['SUPER_ADMIN', 'INVENTORY_ADMIN', 'ENGINEER', 'READ_ONLY'] },
    { label: 'Inventory', path: '/inventory', icon: Building2, color: 'text-indigo-600', roles: ['SUPER_ADMIN', 'INVENTORY_ADMIN', 'ENGINEER', 'READ_ONLY'] },
    { label: 'Dispatch', path: '/dispatch', icon: Truck, color: 'text-rose-600', roles: ['SUPER_ADMIN', 'INVENTORY_ADMIN', 'ENGINEER'] },
    { label: 'Pickup & OEM', path: '/pickup', icon: RotateCcw, color: 'text-emerald-600', roles: ['SUPER_ADMIN', 'INVENTORY_ADMIN', 'ENGINEER'] },
    { label: 'Site Master', path: '/sites', icon: Building2, color: 'text-cyan-600', roles: ['SUPER_ADMIN', 'INVENTORY_ADMIN', 'READ_ONLY'] },
    { label: 'Reports', path: '/reports', icon: FileSpreadsheet, color: 'text-amber-600', roles: ['SUPER_ADMIN', 'INVENTORY_ADMIN', 'READ_ONLY'] },
    { label: 'Users', path: '/users', icon: Users, color: 'text-pink-600', roles: ['SUPER_ADMIN'] },
    { label: 'Activity Logs', path: '/activity', icon: History, color: 'text-purple-600', roles: ['SUPER_ADMIN'] },
    { label: 'Settings', path: '/settings', icon: Settings, color: 'text-slate-600', roles: ['SUPER_ADMIN'] },
  ].filter(item => item.roles.includes(role));

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  return (
    <aside className="w-[245px] flex flex-col h-screen sticky top-0 z-50 shrink-0 bg-slate-50/90 border-r border-slate-200 shadow-sm">
      {/* Brand — Proactive Logo Box */}
      <div className="px-4 pt-5 pb-4 border-b border-slate-200/90">
        <div className="flex flex-col items-center text-center">
          {/* Square Logo Box (~90px x 90px) with 3D Depth */}
          <div
            className="w-[90px] h-[90px] aspect-square bg-white rounded-2xl flex items-center justify-center p-3 shadow-md mx-auto transition-transform hover:scale-102"
            style={{ border: '1.5px solid #334155', boxShadow: '0 4px 14px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)' }}
          >
            <img
              src={pdsLogo}
              alt="Proactive Data Systems"
              className="w-full h-full object-contain block"
            />
          </div>
        </div>
      </div>

      {/* Navigation Links with Tactile 3D Light Effects */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 group ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-500/25 border-b-2 border-indigo-900/40 translate-x-0.5'
                    : 'bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200/70 hover:border-indigo-200 shadow-2xs hover:shadow-md hover:-translate-y-0.5'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`shrink-0 p-1.5 rounded-lg flex items-center justify-center transition-all ${
                    isActive ? 'bg-white/20 text-white shadow-inner' : 'bg-slate-100 text-slate-700 border border-slate-200/80 shadow-inner group-hover:scale-110'
                  }`}>
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : item.color}`} />
                  </span>
                  <span className={`truncate ${isActive ? 'text-white font-black' : 'text-slate-800 font-bold'}`}>{item.label}</span>
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
      <div className="px-3 pb-4 pt-3 border-t border-slate-200">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white border border-slate-200 shadow-sm">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white shadow-sm"
            style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate">{user?.name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <ShieldCheck className="w-2.5 h-2.5 text-indigo-600" />
              <span className="text-[10px] text-slate-500 font-bold capitalize truncate">
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
  const { selectedOrg, setSelectedOrg, organizations } = useOrganization();
  const [now, setNow] = useState(new Date());

  // Continuous real-time clock updating every second
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <header className="h-14 px-6 flex items-center justify-between sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
      {/* Page Title */}
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-5 rounded-full bg-indigo-600 shadow-sm" />
        <h2 className="text-base font-black text-slate-900 tracking-tight">{title}</h2>
      </div>

      {/* Right side: Organization Switcher + Real-time Live Clock + User Badge */}
      <div className="flex items-center gap-3">
        {/* Organization Switcher Dropdown */}
        <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50/80 border border-indigo-200/90 rounded-xl shadow-2xs">
          <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span className="text-[11px] font-extrabold text-indigo-900 uppercase tracking-wider hidden sm:inline">Organization:</span>
          <select
            value={selectedOrg}
            onChange={(e) => setSelectedOrg(e.target.value)}
            className="bg-transparent text-xs font-black text-indigo-700 focus:outline-none cursor-pointer pr-1"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id} className="text-slate-900 font-bold bg-white">
                {org.name}
              </option>
            ))}
          </select>
        </div>

        {/* Real-time Clock Card with 3D subtle depth */}
        <div className="flex items-center gap-2.5 px-3 py-1 bg-slate-50 border border-slate-200 rounded-xl shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>{dateStr}</span>
          </div>
          <div className="w-px h-3.5 bg-slate-300" />
          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 font-mono">
            <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>{timeStr}</span>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-slate-200" />

        {/* User Profile Pill with 3D Depth & Super Admin Badge */}
        <Link
          to="/users"
          className="flex items-center gap-2.5 px-3 py-1 bg-gradient-to-r from-slate-50 to-indigo-50/60 border border-slate-200 rounded-xl shadow-2xs hover:shadow-md hover:border-indigo-300 transition-all duration-200 group"
          style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,1)' }}
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white shadow-sm bg-gradient-to-tr from-indigo-600 to-indigo-700 shrink-0 group-hover:scale-105 transition-transform">
            {user?.name?.[0] || 'U'}
          </div>
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-black text-slate-900 leading-tight max-w-[120px] truncate">{user?.name || 'User'}</span>
            <span className="text-[9px] font-extrabold text-indigo-700 uppercase tracking-wider leading-none mt-0.5">
              {user?.role?.replace(/_/g, ' ') || 'SUPER ADMIN'}
            </span>
          </div>
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
