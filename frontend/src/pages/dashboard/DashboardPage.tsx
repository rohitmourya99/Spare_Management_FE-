import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Package, Layers, MapPin, Cpu, AlertTriangle,
  Truck, RotateCcw, Upload, Search, FileSpreadsheet, ChevronRight,
  Activity, Archive, CheckCircle2, XCircle, Sparkles, TrendingUp,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import api from '../../api';
import { Layout } from '../../components/layout';
import { Card, Badge, StatCard } from '../../components/ui';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316'];

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await api.get('/inventory/dashboard-stats');
      return res.data.data;
    },
    refetchInterval: false,
    refetchOnWindowFocus: false,
    retry: false,
  });

  if (isLoading) {
    return (
      <Layout title="Dashboard & Analytics">
        <div className="flex flex-col items-center justify-center h-80 gap-4 text-slate-400">
          <div className="w-10 h-10 border-3 border-brand-500 border-t-transparent rounded-full animate-spin glow-brand" />
          <span className="text-xs font-semibold tracking-wide text-indigo-300">Loading enterprise metrics...</span>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Dashboard & Analytics">
        <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm">
          ⚠️ Failed to load dashboard. Please verify backend server connectivity.
        </div>
      </Layout>
    );
  }

  const inv = data?.inventorySummary || {};
  const delhi = data?.delhiStoreSummary || {};
  const blr = data?.bengaluruStoreSummary || {};

  const quickActions = [
    { label: 'Import Excel', icon: Upload, gradient: 'from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600', onClick: () => navigate('/inventory?action=import') },
    { label: 'Dispatch Spare', icon: Truck, gradient: 'from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600', onClick: () => navigate('/dispatch') },
    { label: 'Pickup Spare', icon: RotateCcw, gradient: 'from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600', onClick: () => navigate('/pickup') },
    { label: 'Reports', icon: FileSpreadsheet, gradient: 'from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600', onClick: () => navigate('/reports') },
    { label: 'Search Inventory', icon: Search, gradient: 'from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600', onClick: () => navigate('/inventory') },
  ];

  const topSummaryCards = [
    { title: 'Total Spare Parts', value: inv.totalSpareParts ?? 0, icon: Package, color: 'text-blue-400', bg: 'rgba(59, 130, 246, 0.08)' },
    { title: 'Serialized Parts', value: inv.totalSerializedParts ?? 0, icon: Archive, color: 'text-indigo-400', bg: 'rgba(99, 102, 241, 0.08)' },
    { title: 'Non-Serialized', value: inv.totalNonSerializedParts ?? 0, icon: Layers, color: 'text-purple-400', bg: 'rgba(139, 92, 246, 0.08)' },
    { title: 'Total OEMs', value: inv.totalOEMs ?? 0, icon: Cpu, color: 'text-cyan-400', bg: 'rgba(6, 182, 212, 0.08)' },
    { title: 'Delhi Store Stock', value: inv.delhiTotalStock ?? 0, icon: MapPin, color: 'text-emerald-400', bg: 'rgba(16, 185, 129, 0.08)' },
    { title: 'Bengaluru Stock', value: inv.bengaluruTotalStock ?? 0, icon: MapPin, color: 'text-orange-400', bg: 'rgba(249, 115, 22, 0.08)' },
    { title: 'Low Stock Items', value: inv.lowStockCount ?? 0, icon: AlertTriangle, color: 'text-amber-400', bg: 'rgba(245, 158, 11, 0.08)' },
    { title: 'Out of Stock', value: inv.outOfStockCount ?? 0, icon: XCircle, color: 'text-rose-400', bg: 'rgba(239, 68, 68, 0.08)' },
  ];

  return (
    <Layout title="Dashboard & Overview">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl p-6 mb-6 border border-indigo-500/20"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.06) 50%, rgba(16,185,129,0.04) 100%)',
        }}>
        <div className="absolute right-0 top-0 w-96 h-full bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Proactive Spare IMS</span>
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">Enterprise Inventory Dashboard</h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Real-time spare parts monitoring across Delhi &amp; Bengaluru warehouses, BHEL dispatch tracking, and OEM replacements.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/inventory')}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white btn-primary flex items-center gap-1.5"
            >
              <Package className="w-3.5 h-3.5" />
              Manage Inventory
            </button>
          </div>
        </div>
      </div>

      {/* Top 8 Metric Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        {topSummaryCards.map((card, idx) => (
          <StatCard
            key={idx}
            title={card.title}
            value={card.value}
            icon={card.icon}
            color={card.color}
            bg={card.bg}
            onClick={() => navigate('/inventory')}
          />
        ))}
      </div>

      {/* Store Distribution Cards & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Delhi Store */}
        <Card className="border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center border border-blue-500/20">
                <MapPin className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">Delhi Spare Store</p>
                <p className="text-[11px] text-slate-400">Proactive Delhi Warehouse</p>
              </div>
            </div>
            <Badge variant="info">Primary</Badge>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 text-center">
              <p className="text-xl font-extrabold text-white">{delhi.totalItems ?? 0}</p>
              <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Total Spares</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 text-center">
              <p className="text-xl font-extrabold text-emerald-400">{delhi.availableQuantity ?? 0}</p>
              <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Available</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 text-center">
              <p className="text-xl font-extrabold text-amber-400">{inv.lowStockCount ?? 0}</p>
              <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Low Stock</p>
            </div>
          </div>
        </Card>

        {/* Bengaluru Store */}
        <Card className="border-l-4 border-l-orange-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-500/15 flex items-center justify-center border border-orange-500/20">
                <MapPin className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">Bengaluru Spare Store</p>
                <p className="text-[11px] text-slate-400">Proactive South Warehouse</p>
              </div>
            </div>
            <Badge variant="warning">Regional</Badge>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 text-center">
              <p className="text-xl font-extrabold text-white">{blr.totalItems ?? 0}</p>
              <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Total Spares</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 text-center">
              <p className="text-xl font-extrabold text-emerald-400">{blr.availableQuantity ?? 0}</p>
              <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Available</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 text-center">
              <p className="text-xl font-extrabold text-slate-400">0</p>
              <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Low Stock</p>
            </div>
          </div>
        </Card>

        {/* Quick Actions Shortcuts */}
        <Card title="Quick Tasks" subtitle="Frequently used actions">
          <div className="grid grid-cols-2 gap-2 mt-1">
            {quickActions.map((action, idx) => {
              const Icon = action.icon;
              return (
                <button
                  key={idx}
                  onClick={action.onClick}
                  className={`bg-gradient-to-r ${action.gradient} text-white rounded-xl px-3 py-2.5 flex items-center gap-2 text-xs font-semibold shadow-md transition-all hover:scale-102 active:scale-98`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{action.label}</span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Low Stock Alert Bar */}
      {inv.lowStockCount > 0 && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-300">Inventory Reorder Warning</p>
              <p className="text-[11px] text-amber-400/90 mt-0.5">
                {inv.lowStockCount} item(s) are running low. {inv.outOfStockCount > 0 && `${inv.outOfStockCount} item(s) are completely out of stock.`}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/inventory')}
            className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-bold flex items-center gap-1 shrink-0 transition-colors"
          >
            Review Stock <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Monthly Dispatch & Pickup Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <Card title="Monthly Dispatches" subtitle="Outbound spares movement to BHEL sites">
          <div className="h-56 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.monthlyDispatches || []}>
                <defs>
                  <linearGradient id="dispatchGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#475569" fontSize={11} tickLine={false} />
                <YAxis stroke="#475569" fontSize={11} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: 12 }} />
                <Area type="monotone" dataKey="count" name="Dispatches" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#dispatchGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Monthly Pickups" subtitle="Inbound spares & OEM returns">
          <div className="h-56 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.monthlyPickups || []}>
                <defs>
                  <linearGradient id="pickupGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#475569" fontSize={11} tickLine={false} />
                <YAxis stroke="#475569" fontSize={11} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: 12 }} />
                <Area type="monotone" dataKey="count" name="Pickups" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#pickupGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* OEM Distribution & Activity Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* OEM Breakdown */}
        <Card title="OEM Breakdown" subtitle="Distribution of spares by OEM">
          <div className="h-56 mt-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={(data?.oemDistribution || []).slice(0, 9)}
                  dataKey="count"
                  nameKey="name"
                  cx="50%" cy="50%"
                  outerRadius={75}
                  innerRadius={35}
                  paddingAngle={3}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                  fontSize={10}
                >
                  {(data?.oemDistribution || []).slice(0, 9).map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Live Activity Feed */}
        <div className="lg:col-span-2">
          <Card title="Real-Time System Log" subtitle="Recent stock activities" action={
            <button onClick={() => navigate('/activity')} className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1">
              Full Log <ChevronRight className="w-3 h-3" />
            </button>
          }>
            <div className="space-y-2 mt-1 max-h-56 overflow-y-auto pr-1">
              {(data?.recentActivities || []).length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No recent activity recorded</p>
              ) : (
                (data?.recentActivities || []).map((log: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80 hover:border-slate-700 transition-colors">
                    <Activity className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-200 truncate">
                        <span className="font-semibold text-white">{log.user?.name}</span>
                        {' · '}
                        <span className="text-indigo-400 font-bold">{log.action}</span>
                        {log.entityLabel && <span className="text-slate-400"> — {log.entityLabel}</span>}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-mono">{new Date(log.createdAt).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Recent Dispatches & Pickups & Low Stock Rows */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Dispatches */}
        <Card title="Recent Dispatches" action={
          <button onClick={() => navigate('/dispatch')} className="text-xs text-indigo-400 font-semibold flex items-center gap-1">View All <ChevronRight className="w-3 h-3" /></button>
        }>
          <div className="space-y-2 mt-1">
            {(data?.recentDispatches || []).length === 0
              ? <p className="text-xs text-slate-500 text-center py-6">No dispatch records found</p>
              : (data?.recentDispatches || []).map((d: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-200 truncate">{d.inventoryItem?.productName}</p>
                    <p className="text-[10px] text-slate-500">{d.site?.siteName} · {d.dispatchNo}</p>
                  </div>
                  <Badge variant="warning">RESERVED</Badge>
                </div>
              ))}
          </div>
        </Card>

        {/* Recent Pickups */}
        <Card title="Recent Pickups" action={
          <button onClick={() => navigate('/pickup')} className="text-xs text-indigo-400 font-semibold flex items-center gap-1">View All <ChevronRight className="w-3 h-3" /></button>
        }>
          <div className="space-y-2 mt-1">
            {(data?.recentPickups || []).length === 0
              ? <p className="text-xs text-slate-500 text-center py-6">No pickup records found</p>
              : (data?.recentPickups || []).map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-200 truncate">{p.inventoryItem?.productName}</p>
                    <p className="text-[10px] text-slate-500">{p.site?.siteName} · {p.pickupNo}</p>
                  </div>
                  <Badge variant="success">IN</Badge>
                </div>
              ))}
          </div>
        </Card>

        {/* Low Stock Alerts */}
        <Card title="Low Stock Monitoring">
          <div className="space-y-2 mt-1">
            {(data?.lowStockAlerts || []).length === 0
              ? <div className="flex flex-col items-center py-6 gap-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  <p className="text-xs font-semibold text-slate-400">All inventory levels healthy</p>
                </div>
              : (data?.lowStockAlerts || []).map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-200 truncate">{item.productName}</p>
                    <p className="text-[10px] text-slate-500">{item.oem?.name}</p>
                  </div>
                  <span className={`text-xs font-extrabold px-2 py-0.5 rounded-lg ${item.availableQuantity === 0 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                    {item.availableQuantity} left
                  </span>
                </div>
              ))}
          </div>
        </Card>
      </div>
    </Layout>
  );
};
