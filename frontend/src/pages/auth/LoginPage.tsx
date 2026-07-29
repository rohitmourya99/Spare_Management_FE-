import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, AlertCircle } from 'lucide-react';
import api from '../../api';
import { useAuthStore } from '../../store/useAuthStore';
import { Button } from '../../components/ui';
import pdsLogo from '../../assets/pds-logo.png';

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
    <div className="min-h-screen bg-white flex items-center justify-center p-4 relative overflow-hidden" style={{ backgroundColor: '#ffffff' }}>
      {/* Subtle Indigo & Crimson background accents */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Centered sharp white card container */}
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl relative z-10 border border-slate-200">
        {/* Brand logo — Strict Square box with thin #9CA3AF border & minor drop shadow */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 aspect-square bg-white rounded-xl flex items-center justify-center mx-auto mb-3 p-2.5 shadow-md"
            style={{ border: '1px solid #9CA3AF' }}
          >
            <img src={pdsLogo} alt="Proactive Data Systems" className="w-full h-full object-contain block" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Spare IMS</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">Enterprise Inventory Management System</p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-600 text-sm font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@proactivedata.in"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-colors font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-colors font-medium"
              />
            </div>
          </div>

          <Button
            type="submit"
            isLoading={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-500/20"
            icon={<Shield className="w-4 h-4" />}
          >
            Sign In to Dashboard
          </Button>
        </form>

        {/* Quick Demo Login Preset Buttons */}
        <div className="mt-8 pt-6 border-t border-slate-200">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 text-center">
            Demo Login Presets
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => fillQuickLogin('admin@proactivedata.in', 'Admin@123')}
              className="px-2.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-left transition-colors"
            >
              <span className="font-bold text-indigo-600 block">Super Admin</span>
              <span className="text-[10px] text-slate-500 truncate block font-medium">admin@proactivedata.in</span>
            </button>
            <button
              onClick={() => fillQuickLogin('inventory@proactivedata.in', 'Inv@123')}
              className="px-2.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-left transition-colors"
            >
              <span className="font-bold text-emerald-600 block">Inv Admin</span>
              <span className="text-[10px] text-slate-500 truncate block font-medium">inventory@proactivedata.in</span>
            </button>
            <button
              onClick={() => fillQuickLogin('engineer@proactivedata.in', 'Eng@123')}
              className="px-2.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-left transition-colors"
            >
              <span className="font-bold text-amber-600 block">Engineer</span>
              <span className="text-[10px] text-slate-500 truncate block font-medium">engineer@proactivedata.in</span>
            </button>
            <button
              onClick={() => fillQuickLogin('viewer@proactivedata.in', 'View@123')}
              className="px-2.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-left transition-colors"
            >
              <span className="font-bold text-purple-600 block">Read Only</span>
              <span className="text-[10px] text-slate-500 truncate block font-medium">viewer@proactivedata.in</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
