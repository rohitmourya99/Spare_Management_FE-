import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Lock, Mail, AlertCircle, Package, Truck,
  Building2, CheckCircle2, ArrowRight, ShieldCheck, Cpu
} from 'lucide-react';
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
      setError(err.response?.data?.message || 'Login failed. Please check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 md:p-8 relative overflow-hidden" style={{ backgroundColor: '#ffffff' }}>
      {/* Background Soft Glow Accents */}
      <div className="absolute -top-24 -left-24 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container Card with 3D Depth */}
      <div className="w-full max-w-5xl bg-white rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative z-10"
        style={{ boxShadow: '0 20px 50px -10px rgba(15,23,42,0.08), 0 10px 20px -5px rgba(0,0,0,0.04)' }}>
        
        {/* Left Side: Modern Feature & Value Proposition Showcase (Hidden on Mobile) */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-8 lg:p-10 flex flex-col justify-between text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-indigo-300">Enterprise Logistics</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white leading-tight">
              Proactive Stock List Management System
            </h2>
            <p className="text-xs text-slate-300 mt-2 font-medium leading-relaxed">
              Centralized stock tracking for Delhi &amp; Bengaluru warehouses, automated BHEL site dispatches, and OEM return receipts.
            </p>

            {/* 3D Highlight Feature Cards */}
            <div className="space-y-3 mt-8">
              <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex items-start gap-3 shadow-lg">
                <div className="p-2 rounded-xl bg-indigo-600/40 text-indigo-300 shrink-0 border border-indigo-400/20">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Dual Warehouse Control</p>
                  <p className="text-[11px] text-slate-300 font-medium">Real-time stock balance in Delhi &amp; Bengaluru.</p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex items-start gap-3 shadow-lg">
                <div className="p-2 rounded-xl bg-emerald-600/40 text-emerald-300 shrink-0 border border-emerald-400/20">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">BHEL Site Dispatches</p>
                  <p className="text-[11px] text-slate-300 font-medium">Outbound tracking with SPOC &amp; AWB logging.</p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex items-start gap-3 shadow-lg">
                <div className="p-2 rounded-xl bg-purple-600/40 text-purple-300 shrink-0 border border-purple-400/20">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Serialized Parts Audit</p>
                  <p className="text-[11px] text-slate-300 font-medium">Unique serial number tracing &amp; QR history.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-8 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400 font-semibold">
            <span>© Proactive Data Systems</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" /> Secure SSL Auth
            </span>
          </div>
        </div>

        {/* Right Side: High Contrast 3D Sign In Form */}
        <div className="lg:col-span-7 p-8 lg:p-12 bg-white flex flex-col justify-center">
          {/* Logo Container — 90px x 90px Square Box with #334155 border & 3D shadow */}
          <div className="text-center mb-8">
            <div
              className="w-[90px] h-[90px] aspect-square bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 p-3 shadow-md transition-transform hover:scale-102"
              style={{ border: '1.5px solid #334155', boxShadow: '0 6px 18px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)' }}
            >
              <img src={pdsLogo} alt="Proactive Data Systems" className="w-full h-full object-contain block" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">System Sign In</h1>
            <p className="text-xs text-slate-500 mt-1 font-bold">Enter your registered email and password to access dashboard</p>
          </div>

          {error && (
            <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-700 text-xs font-bold shadow-sm">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5 max-w-md mx-auto w-full">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Email / Username *</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@proactivedata.in"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 font-bold focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 shadow-2xs transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Password *</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 font-bold focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 shadow-2xs transition-all"
                />
              </div>
            </div>

            {/* 3D Tactile Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black text-sm rounded-xl shadow-lg shadow-indigo-500/25 border-b-2 border-indigo-900/40 flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
            >
              {loading ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </form>

          <p className="text-[11px] text-slate-500 text-center mt-8 font-semibold">
            Authorized internal access only. Confidential Proactive Data Systems portal.
          </p>
        </div>
      </div>
    </div>
  );
};
