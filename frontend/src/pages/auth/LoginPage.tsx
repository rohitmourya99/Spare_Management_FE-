import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, AlertCircle } from 'lucide-react';
import api from '../../api';
import { useAuthStore } from '../../store/useAuthStore';
import { Button } from '../../components/ui';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password });
      const { user, accessToken, refreshToken } = res.data.data;
      setAuth(user, accessToken, refreshToken);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillQuickLogin = (emailStr: string, passStr: string) => {
    setEmail(emailStr);
    setPassword(passStr);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow accents */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md glass-panel p-8 rounded-2xl shadow-2xl relative z-10 border border-slate-800">
        {/* Brand logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center font-bold text-white text-xl mx-auto mb-3 shadow-lg shadow-brand-600/30">
            PDS
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Spare IMS</h1>
          <p className="text-xs text-slate-400 mt-1">Enterprise Inventory Management System</p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@proactivedata.in"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              />
            </div>
          </div>

          <Button type="submit" isLoading={loading} className="w-full py-3" icon={<Shield className="w-4 h-4" />}>
            Sign In to Dashboard
          </Button>
        </form>

        {/* Quick Demo Login Preset Buttons */}
        <div className="mt-8 pt-6 border-t border-slate-800/80">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 text-center">
            Demo Login Presets
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => fillQuickLogin('admin@proactivedata.in', 'Admin@123')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 text-left transition-colors"
            >
              <span className="font-medium text-brand-400 block">Super Admin</span>
              <span className="text-[10px] text-slate-500 truncate block">admin@proactivedata.in</span>
            </button>
            <button
              onClick={() => fillQuickLogin('inventory@proactivedata.in', 'Inv@123')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 text-left transition-colors"
            >
              <span className="font-medium text-emerald-400 block">Inv Admin</span>
              <span className="text-[10px] text-slate-500 truncate block">inventory@proactivedata.in</span>
            </button>
            <button
              onClick={() => fillQuickLogin('engineer@proactivedata.in', 'Eng@123')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 text-left transition-colors"
            >
              <span className="font-medium text-amber-400 block">Engineer</span>
              <span className="text-[10px] text-slate-500 truncate block">engineer@proactivedata.in</span>
            </button>
            <button
              onClick={() => fillQuickLogin('viewer@proactivedata.in', 'View@123')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 text-left transition-colors"
            >
              <span className="font-medium text-purple-400 block">Read Only</span>
              <span className="text-[10px] text-slate-500 truncate block">viewer@proactivedata.in</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
