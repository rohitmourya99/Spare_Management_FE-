import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Package, Layers, MapPin, Cpu, AlertTriangle,
  Truck, RotateCcw, Upload, Search, FileSpreadsheet, ChevronRight,
  Activity, Archive, CheckCircle2, XCircle, Sparkles, TrendingUp, Filter,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import api from '../../api';
import { Layout } from '../../components/layout';
import { Card, Badge, StatCard } from '../../components/ui';

const COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0891b2', '#65a30d', '#ea580c'];

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

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

  const { data: inventoryItemsData, isLoading: isLoadingInventory } = useQuery({
    queryKey: ['dashboard-inventory-items'],
    queryFn: async () => {
      const res = await api.get('/inventory?limit=300');
      return res.data.data.items || [];
    },
    refetchInterval: false,
  });

  // Filter items based on selected card filter & search input using useMemo
  // (Called unconditionally at top level to obey React Rule of Hooks)
  const displayedItems = useMemo(() => {
    if (!inventoryItemsData || !Array.isArray(inventoryItemsData)) return [];
    let items = [...inventoryItemsData];

    switch (selectedFilter) {
      case 'SERIALIZED':
        items = items.filter((i: any) => i.is_serialized || i.isSerialized);
        break;
      case 'NON_SERIALIZED':
        items = items.filter((i: any) => !i.is_serialized && !i.isSerialized);
        break;
      case 'DELHI':
        items = items.filter((i: any) =>
          (i.store || i.location?.name || i.location || '').toLowerCase().includes('delhi')
        );
        break;
      case 'BENGALURU':
        items = items.filter((i: any) =>
          (i.store || i.location?.name || i.location || '').toLowerCase().includes('bengaluru')
        );
        break;
      case 'LOW_STOCK':
        items = items.filter(
          (i: any) =>
            Number(i.availableQuantity ?? i.quantity) <= Number(i.minStock || i.min_stock || 5) &&
            Number(i.availableQuantity ?? i.quantity) > 0
        );
        break;
      case 'OUT_OF_STOCK':
        items = items.filter((i: any) => Number(i.availableQuantity ?? i.quantity) === 0);
        break;
      case 'OEM':
        items.sort((a: any, b: any) => (a.oem?.name || '').localeCompare(b.oem?.name || ''));
        break;
      case 'ALL':
      default:
        break;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (i: any) =>
          i.productName?.toLowerCase().includes(q) ||
          i.partCode?.toLowerCase().includes(q) ||
          i.serialNumber?.toLowerCase().includes(q) ||
          i.oem?.name?.toLowerCase().includes(q) ||
          i.spareId?.toLowerCase().includes(q)
      );
    }

    return items;
  }, [inventoryItemsData, selectedFilter, searchQuery]);

  if (isLoading) {
    return (
      <Layout title="Dashboard & Analytics">
        <div className="flex flex-col items-center justify-center h-80 gap-4 text-slate-400">
          <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold tracking-wide text-indigo-600">Loading enterprise metrics...</span>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Dashboard & Analytics">
        <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm font-bold">
          ⚠️ Failed to load dashboard. Please verify backend server connectivity.
        </div>
      </Layout>
    );
  }

  const inv = data?.inventorySummary || {};
  const delhi = data?.delhiStoreSummary || {};
  const blr = data?.bengaluruStoreSummary || {};

  const quickActions = [
    { label: 'Import Excel', icon: Upload, gradient: 'from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 border-b-2 border-indigo-900/30', onClick: () => navigate('/inventory?action=import') },
    { label: 'Dispatch Spare', icon: Truck, gradient: 'from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 border-b-2 border-rose-900/30', onClick: () => navigate('/dispatch') },
    { label: 'Pickup Spare', icon: RotateCcw, gradient: 'from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 border-b-2 border-emerald-900/30', onClick: () => navigate('/pickup') },
    { label: 'Reports', icon: FileSpreadsheet, gradient: 'from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 border-b-2 border-amber-900/30', onClick: () => navigate('/reports') },
    { label: 'Search Stock List', icon: Search, gradient: 'from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 border-b-2 border-blue-900/30', onClick: () => navigate('/inventory') },
  ];

  const topSummaryCards = [
    { id: 'ALL', title: 'Total Spare Parts', value: inv.totalSpareParts ?? 0, icon: Package, color: 'text-blue-600' },
    { id: 'SERIALIZED', title: 'Serialized Parts', value: inv.totalSerializedParts ?? 0, icon: Archive, color: 'text-indigo-600' },
    { id: 'NON_SERIALIZED', title: 'Non-Serialized', value: inv.totalNonSerializedParts ?? 0, icon: Layers, color: 'text-purple-600' },
    { id: 'OEM', title: 'Total OEMs', value: inv.totalOEMs ?? 0, icon: Cpu, color: 'text-cyan-600' },
    { id: 'DELHI', title: 'Delhi Store Stock', value: inv.delhiTotalStock ?? 0, icon: MapPin, color: 'text-emerald-600' },
    { id: 'BENGALURU', title: 'Bengaluru Stock', value: inv.bengaluruTotalStock ?? 0, icon: MapPin, color: 'text-orange-600' },
    { id: 'LOW_STOCK', title: 'Low Stock Items', value: inv.lowStockCount ?? 0, icon: AlertTriangle, color: 'text-amber-600' },
    { id: 'OUT_OF_STOCK', title: 'Out of Stock', value: inv.outOfStockCount ?? 0, icon: XCircle, color: 'text-rose-600' },
  ];

  const activeCardObj = topSummaryCards.find((c) => c.id === selectedFilter) || topSummaryCards[0];

  return (
    <Layout title="Dashboard & Overview">
      {/* Hero Welcome Banner with 3D Depth */}
      <div
        className="relative overflow-hidden rounded-2xl p-6 mb-6 border border-indigo-100 bg-gradient-to-br from-indigo-50/90 via-purple-50/40 to-white shadow-lg transition-transform"
        style={{ boxShadow: '0 10px 30px -5px rgba(99,102,241,0.08), inset 0 1px 0 0 rgba(255,255,255,1)' }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-600">Proactive Spare IMS</span>
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Enterprise Stock List Dashboard</h1>
            <p className="text-xs text-slate-600 mt-1 max-w-xl font-medium">
              Real-time spare parts monitoring across Delhi &amp; Bengaluru warehouses, BHEL dispatch tracking, and OEM replacements.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/stock-list')}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 border-b-2 border-indigo-800 flex items-center gap-1.5 transition-all hover:-translate-y-0.5"
            >
              <Package className="w-3.5 h-3.5" />
              Manage Stock List
            </button>
          </div>
        </div>
      </div>

      {/* Top 8 Metric Stat Cards (Interactive 1-Click Filters) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        {topSummaryCards.map((card) => (
          <StatCard
            key={card.id}
            title={card.title}
            value={card.value}
            icon={card.icon}
            color={card.color}
            isActive={selectedFilter === card.id}
            onClick={() => setSelectedFilter(card.id)}
          />
        ))}
      </div>

      {/* Interactive Metric Card Drill-Down Detail Table */}
      <div className="mb-6 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-200 text-indigo-600 shrink-0">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Showing results for: <span className="text-indigo-600 font-black">{activeCardObj.title}</span>
                </h3>
                <span className="text-xs bg-indigo-100 text-indigo-800 font-extrabold px-2.5 py-0.5 rounded-full border border-indigo-200">
                  {displayedItems.length} {displayedItems.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Click any top summary card above to instantly filter and inspect matching spare parts in real time.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search filtered list..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600 w-44 md:w-56"
              />
            </div>

            {/* Reset View Button */}
            {selectedFilter !== 'ALL' && (
              <button
                onClick={() => {
                  setSelectedFilter('ALL');
                  setSearchQuery('');
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 border border-slate-300 transition-colors shrink-0 shadow-2xs"
              >
                <XCircle className="w-3.5 h-3.5 text-slate-500" />
                Reset View
              </button>
            )}
          </div>
        </div>

        {/* Filtered Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                <th className="p-3">Spare Part</th>
                <th className="p-3">OEM Vendor</th>
                <th className="p-3">Serial Number</th>
                <th className="p-3">Store Location</th>
                <th className="p-3">Available Stock</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-900">
              {isLoadingInventory ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-semibold">
                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading drill-down data...
                  </td>
                </tr>
              ) : displayedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-semibold">
                    <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    No spare parts matching selected filter <span className="font-bold text-slate-800">"{activeCardObj.title}"</span>.
                  </td>
                </tr>
              ) : (
                displayedItems.slice(0, 15).map((item: any) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-bold text-slate-900">
                      <div>{item.productName}</div>
                      <div className="text-[10px] text-indigo-600 font-mono font-bold mt-0.5">
                        {item.spareId} {item.partCode ? `· SKU: ${item.partCode}` : ''}
                      </div>
                    </td>
                    <td className="p-3 font-bold text-slate-700">
                      {item.oem?.name || 'Standard OEM'}
                    </td>
                    <td className="p-3 font-mono">
                      {item.serialNumber ? (
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 font-bold text-[11px]">
                          {item.serialNumber}
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-medium text-[11px]">
                          Non-Serialized
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-semibold text-slate-800">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${(item.store || item.location?.name || '').includes('Delhi') ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-orange-50 text-orange-800 border-orange-200'}`}>
                        <MapPin className="w-3 h-3" />
                        {item.store || item.location?.name || 'Delhi'}
                      </span>
                    </td>
                    <td className="p-3 font-extrabold text-slate-900">
                      {item.availableQuantity ?? item.quantity} / {item.quantity} {item.unit || 'PCS'}
                    </td>
                    <td className="p-3">
                      <Badge variant={item.status === 'AVAILABLE' ? 'success' : item.status === 'RESERVED' ? 'warning' : 'danger'}>
                        {item.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => navigate('/inventory')}
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold border border-indigo-200 transition-colors inline-flex items-center gap-1"
                      >
                        Inspect <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {displayedItems.length > 15 && (
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-center">
              <button
                onClick={() => navigate('/inventory')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
              >
                View all {displayedItems.length} items in Stock List <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Store Distribution Cards & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Delhi Store */}
        <Card className="border-l-4 border-l-blue-600">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-200 shadow-inner">
                <MapPin className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">Delhi Stock Store</p>
                <p className="text-[11px] text-slate-500 font-medium">Proactive Delhi Warehouse</p>
              </div>
            </div>
            <Badge variant="info">Primary</Badge>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-gradient-to-b from-slate-50 to-slate-100/70 border border-slate-200/80 rounded-xl p-3 text-center shadow-inner">
              <p className="text-xl font-extrabold text-slate-900">{delhi.totalItems ?? 0}</p>
              <p className="text-[10px] font-bold text-slate-600 mt-0.5">Total Spares</p>
            </div>
            <div className="bg-gradient-to-b from-slate-50 to-slate-100/70 border border-slate-200/80 rounded-xl p-3 text-center shadow-inner">
              <p className="text-xl font-extrabold text-emerald-600">{delhi.availableQuantity ?? 0}</p>
              <p className="text-[10px] font-bold text-slate-600 mt-0.5">Available</p>
            </div>
            <div className="bg-gradient-to-b from-slate-50 to-slate-100/70 border border-slate-200/80 rounded-xl p-3 text-center shadow-inner">
              <p className="text-xl font-extrabold text-amber-600">{inv.lowStockCount ?? 0}</p>
              <p className="text-[10px] font-bold text-slate-600 mt-0.5">Low Stock</p>
            </div>
          </div>
        </Card>

        {/* Bengaluru Store */}
        <Card className="border-l-4 border-l-orange-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center border border-orange-200 shadow-inner">
                <MapPin className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">Bengaluru Stock Store</p>
                <p className="text-[11px] text-slate-500 font-medium">Proactive South Warehouse</p>
              </div>
            </div>
            <Badge variant="warning">Regional</Badge>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-gradient-to-b from-slate-50 to-slate-100/70 border border-slate-200/80 rounded-xl p-3 text-center shadow-inner">
              <p className="text-xl font-extrabold text-slate-900">{blr.totalItems ?? 0}</p>
              <p className="text-[10px] font-bold text-slate-600 mt-0.5">Total Spares</p>
            </div>
            <div className="bg-gradient-to-b from-slate-50 to-slate-100/70 border border-slate-200/80 rounded-xl p-3 text-center shadow-inner">
              <p className="text-xl font-extrabold text-emerald-600">{blr.availableQuantity ?? 0}</p>
              <p className="text-[10px] font-bold text-slate-600 mt-0.5">Available</p>
            </div>
            <div className="bg-gradient-to-b from-slate-50 to-slate-100/70 border border-slate-200/80 rounded-xl p-3 text-center shadow-inner">
              <p className="text-xl font-extrabold text-slate-400">0</p>
              <p className="text-[10px] font-bold text-slate-600 mt-0.5">Low Stock</p>
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
                  className={`bg-gradient-to-r ${action.gradient} text-white rounded-xl px-3 py-2.5 flex items-center gap-2 text-xs font-bold shadow-md transition-all hover:-translate-y-0.5 active:translate-y-0`}
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
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between shadow-md" style={{ boxShadow: '0 4px 18px -2px rgba(245, 158, 11, 0.1)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-900">Stock Reorder Warning</p>
              <p className="text-[11px] text-amber-700 font-medium mt-0.5">
                {inv.lowStockCount} item(s) are running low. {inv.outOfStockCount > 0 && `${inv.outOfStockCount} item(s) are completely out of stock.`}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/inventory')}
            className="px-3 py-1.5 rounded-xl bg-amber-600 text-white hover:bg-amber-700 text-xs font-bold flex items-center gap-1 shrink-0 transition-all hover:-translate-y-0.5 border-b-2 border-amber-800 shadow-md"
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
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', color: '#0f172a', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }} />
                <Area type="monotone" dataKey="count" name="Dispatches" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#dispatchGrad)" />
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
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', color: '#0f172a', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }} />
                <Area type="monotone" dataKey="count" name="Pickups" stroke="#059669" strokeWidth={3} fillOpacity={1} fill="url(#pickupGrad)" />
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
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', color: '#0f172a', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Live Activity Feed */}
        <div className="lg:col-span-2">
          <Card title="Real-Time System Log" subtitle="Recent stock activities" action={
            <button onClick={() => navigate('/activity')} className="text-xs text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1">
              Full Log <ChevronRight className="w-3 h-3" />
            </button>
          }>
            <div className="space-y-2 mt-1 max-h-56 overflow-y-auto pr-1">
              {(data?.recentActivities || []).length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6 font-medium">No recent activity recorded</p>
              ) : (
                (data?.recentActivities || []).map((log: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition-colors shadow-2xs">
                    <Activity className="w-3.5 h-3.5 text-indigo-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-800 truncate">
                        <span className="font-bold text-slate-900">{log.user?.name}</span>
                        {' · '}
                        <span className="text-indigo-600 font-bold">{log.action}</span>
                        {log.entityLabel && <span className="text-slate-600 font-medium"> — {log.entityLabel}</span>}
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
          <button onClick={() => navigate('/dispatch')} className="text-xs text-indigo-600 font-bold flex items-center gap-1">View All <ChevronRight className="w-3 h-3" /></button>
        }>
          <div className="space-y-2 mt-1">
            {(data?.recentDispatches || []).length === 0
              ? <p className="text-xs text-slate-500 text-center py-6 font-medium">No dispatch records found</p>
              : (data?.recentDispatches || []).map((d: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">{d.inventoryItem?.productName}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{d.site?.siteName} · {d.dispatchNo}</p>
                  </div>
                  <Badge variant="warning">RESERVED</Badge>
                </div>
              ))}
          </div>
        </Card>

        {/* Recent Pickups */}
        <Card title="Recent Pickups" action={
          <button onClick={() => navigate('/pickup')} className="text-xs text-indigo-600 font-bold flex items-center gap-1">View All <ChevronRight className="w-3 h-3" /></button>
        }>
          <div className="space-y-2 mt-1">
            {(data?.recentPickups || []).length === 0
              ? <p className="text-xs text-slate-500 text-center py-6 font-medium">No pickup records found</p>
              : (data?.recentPickups || []).map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">{p.inventoryItem?.productName}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{p.site?.siteName} · {p.pickupNo}</p>
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
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  <p className="text-xs font-bold text-slate-700">All inventory levels healthy</p>
                </div>
              : (data?.lowStockAlerts || []).map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 border border-amber-200/80">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">{item.productName}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{item.oem?.name}</p>
                  </div>
                  <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-lg ${item.availableQuantity === 0 ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
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
