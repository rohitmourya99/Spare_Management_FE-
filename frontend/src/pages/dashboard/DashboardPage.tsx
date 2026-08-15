import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import {
  Package, Layers, MapPin, Cpu, AlertTriangle,
  Truck, RotateCcw, Upload, Search, FileSpreadsheet, ChevronRight,
  Activity, Archive, CheckCircle2, XCircle, Sparkles, TrendingUp, Filter,
  ShieldAlert, Clock, History, UserCheck, ArrowRight
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
  const [activeCardFilter, setActiveCardFilter] = useState<string>('TOTAL_SPARE_PARTS');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isStockModalOpen, setIsStockModalOpen] = useState<boolean>(false);

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

  const { data: dynamicLowStock, isLoading: isLoadingDynamic, refetch: refetchDynamicLowStock } = useQuery({
    queryKey: ['dynamic-low-stock'],
    queryFn: async () => {
      const res = await api.get('/stock/low-stock-details');
      return res.data;
    },
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  const handleOpenStockModal = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    refetchDynamicLowStock();
    setIsStockModalOpen(true);
  };

  const { data: inventoryItemsData, isLoading: isLoadingInventory } = useQuery({
    queryKey: ['dashboard-inventory-items'],
    queryFn: async () => {
      const res = await api.get('/inventory?limit=300');
      return res.data.data.items || [];
    },
    refetchInterval: false,
  });

  // Filter Stock items based on active card filter & search input
  const filteredInventoryItems = useMemo(() => {
    if (!inventoryItemsData || !Array.isArray(inventoryItemsData)) return [];
    let items = [...inventoryItemsData];

    switch (activeCardFilter) {
      case 'SERIALIZED_PARTS':
        items = items.filter((i: any) => i.is_serialized || i.isSerialized);
        break;
      case 'NON_SERIALIZED':
        items = items.filter((i: any) => !i.is_serialized && !i.isSerialized);
        break;
      case 'DELHI_STORE':
        items = items.filter((i: any) =>
          (i.store || i.location?.name || i.location || '').toLowerCase().includes('delhi')
        );
        break;
      case 'BENGALURU_STORE':
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
      case 'TOTAL_OEM':
        items.sort((a: any, b: any) => (a.oem?.name || '').localeCompare(b.oem?.name || ''));
        break;
      case 'TOTAL_SPARE_PARTS':
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
  }, [inventoryItemsData, activeCardFilter, searchQuery]);

  // Filter Activities & Audit Logs
  const filteredActivities = useMemo(() => {
    const activities = data?.recentActivities || [];
    if (!Array.isArray(activities)) return [];
    let items = [...activities];
    const todayStr = new Date().toISOString().split('T')[0];

    if (activeCardFilter === 'TODAYS_ACTIVITIES') {
      items = items.filter((act: any) => {
        if (!act.createdAt) return true;
        const d = new Date(act.createdAt).toISOString().split('T')[0];
        return d === todayStr;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (act: any) =>
          act.userName?.toLowerCase().includes(q) ||
          act.action?.toLowerCase().includes(q) ||
          act.module?.toLowerCase().includes(q) ||
          act.entityLabel?.toLowerCase().includes(q)
      );
    }

    return items;
  }, [data?.recentActivities, activeCardFilter, searchQuery]);

  // Filter Dispatches
  const filteredDispatches = useMemo(() => {
    const dispatches = data?.recentDispatches || [];
    if (!Array.isArray(dispatches)) return [];
    let items = [...dispatches];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (d: any) =>
          d.dispatchNo?.toLowerCase().includes(q) ||
          d.inventoryItem?.productName?.toLowerCase().includes(q) ||
          d.site?.siteName?.toLowerCase().includes(q)
      );
    }

    return items;
  }, [data?.recentDispatches, searchQuery]);

  // Filter Pickups
  const filteredPickups = useMemo(() => {
    const pickups = data?.recentPickups || [];
    if (!Array.isArray(pickups)) return [];
    let items = [...pickups];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (p: any) =>
          p.pickupNo?.toLowerCase().includes(q) ||
          p.inventoryItem?.productName?.toLowerCase().includes(q) ||
          p.site?.siteName?.toLowerCase().includes(q)
      );
    }

    return items;
  }, [data?.recentPickups, searchQuery]);

  // Filter Failed Logins
  const filteredFailedLogins = useMemo(() => {
    const activities = data?.recentActivities || [];
    if (!Array.isArray(activities)) return [];
    let items = activities.filter(
      (act: any) =>
        (act.action || '').toUpperCase().includes('FAILED') ||
        (act.action || '').toUpperCase().includes('LOGIN_FAILED')
    );

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (act: any) =>
          act.userName?.toLowerCase().includes(q) ||
          act.entityLabel?.toLowerCase().includes(q)
      );
    }

    return items;
  }, [data?.recentActivities, searchQuery]);

  const isStockCategory = ['TOTAL_SPARE_PARTS', 'SERIALIZED_PARTS', 'NON_SERIALIZED', 'TOTAL_OEM', 'DELHI_STORE', 'BENGALURU_STORE', 'LOW_STOCK', 'OUT_OF_STOCK'].includes(activeCardFilter);
  const isActivityCategory = ['TODAYS_ACTIVITIES', 'AUDIT_LOGS'].includes(activeCardFilter);
  const isDispatchCategory = activeCardFilter === 'TODAYS_DISPATCH';
  const isPickupCategory = activeCardFilter === 'TODAYS_PICKUP';
  const isFailedLoginsCategory = activeCardFilter === 'FAILED_LOGINS';

  const currentListLength = isStockCategory
    ? filteredInventoryItems.length
    : isActivityCategory
    ? filteredActivities.length
    : isDispatchCategory
    ? filteredDispatches.length
    : isPickupCategory
    ? filteredPickups.length
    : filteredFailedLogins.length;

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
    { label: 'Import Excel', icon: Upload, path: '/stock-list?action=import', gradient: 'from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 border-b-2 border-indigo-900/30' },
    { label: 'Dispatch Spare', icon: Truck, path: '/dispatch', gradient: 'from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 border-b-2 border-rose-900/30' },
    { label: 'Pickup Spare', icon: RotateCcw, path: '/pickup', gradient: 'from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 border-b-2 border-emerald-900/30' },
    { label: 'Reports', icon: FileSpreadsheet, path: '/reports', gradient: 'from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 border-b-2 border-amber-900/30' },
  ];

  const topSummaryCards = [
    { id: 'TOTAL_SPARE_PARTS', title: 'Total Spare Parts', value: inv.totalSpareParts ?? 0, icon: Package, color: 'text-blue-600' },
    { id: 'SERIALIZED_PARTS', title: 'Serialized Parts', value: inv.totalSerializedParts ?? 0, icon: Archive, color: 'text-indigo-600' },
    { id: 'NON_SERIALIZED', title: 'Non-Serialized', value: inv.totalNonSerializedParts ?? 0, icon: Layers, color: 'text-purple-600' },
    { id: 'TOTAL_OEM', title: 'Total OEMs', value: inv.totalOEMs ?? 0, icon: Cpu, color: 'text-cyan-600' },
    { id: 'DELHI_STORE', title: 'Delhi Store Stock', value: inv.delhiTotalStock ?? 0, icon: MapPin, color: 'text-emerald-600' },
    { id: 'BENGALURU_STORE', title: 'Bengaluru Stock', value: inv.bengaluruTotalStock ?? 0, icon: MapPin, color: 'text-orange-600' },
    { id: 'LOW_STOCK', title: 'Low Stock Items', value: inv.lowStockCount ?? 0, icon: AlertTriangle, color: 'text-amber-600' },
    { id: 'OUT_OF_STOCK', title: 'Out of Stock', value: inv.outOfStockCount ?? 0, icon: XCircle, color: 'text-rose-600' },
    { id: 'TODAYS_ACTIVITIES', title: "Today's Activities", value: inv.todaysActivitiesCount ?? 0, icon: History, color: 'text-indigo-700' },
    { id: 'AUDIT_LOGS', title: 'Total Audit Logs', value: inv.totalActivitiesCount ?? 0, icon: Activity, color: 'text-purple-700' },
    { id: 'TODAYS_DISPATCH', title: "Today's Dispatch", value: inv.todaysDispatchCount ?? 0, icon: Truck, color: 'text-blue-700' },
    { id: 'TODAYS_PICKUP', title: "Today's Pickup", value: inv.todaysPickupCount ?? 0, icon: RotateCcw, color: 'text-emerald-700' },
    { id: 'FAILED_LOGINS', title: 'Failed Login Attempts', value: inv.failedLoginAttemptsCount ?? 0, icon: ShieldAlert, color: 'text-rose-700' },
  ];

  const activeCardObj = topSummaryCards.find((c) => c.id === activeCardFilter) || topSummaryCards[0];

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
        </div>
      </div>

      {/* Top 13 Metric Stat Cards (Interactive 1-Click Filters) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {topSummaryCards.map((card) => (
          <StatCard
            key={card.id}
            title={card.title}
            value={card.value}
            icon={card.icon}
            color={card.color}
            isActive={activeCardFilter === card.id}
            onClick={() => setActiveCardFilter(card.id)}
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
                  {currentListLength} {currentListLength === 1 ? 'item' : 'items'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Click any top summary card above to instantly filter and inspect matching records in real time.
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
            {activeCardFilter !== 'TOTAL_SPARE_PARTS' && (
              <button
                onClick={() => {
                  setActiveCardFilter('TOTAL_SPARE_PARTS');
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
                {isStockCategory && (
                  <>
                    <th className="p-3">Spare Part</th>
                    <th className="p-3">OEM Vendor</th>
                    <th className="p-3">Serial Number</th>
                    <th className="p-3">Store Location</th>
                    <th className="p-3">Available Stock</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </>
                )}
                {isActivityCategory && (
                  <>
                    <th className="p-3">User &amp; Role</th>
                    <th className="p-3">Action / Activity</th>
                    <th className="p-3">Module &amp; Entity</th>
                    <th className="p-3">Change Details</th>
                    <th className="p-3 text-right">Timestamp</th>
                  </>
                )}
                {isDispatchCategory && (
                  <>
                    <th className="p-3">Dispatch No</th>
                    <th className="p-3">Spare Part Item</th>
                    <th className="p-3">Destination BHEL Site</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Dispatch Date</th>
                  </>
                )}
                {isPickupCategory && (
                  <>
                    <th className="p-3">Pickup No</th>
                    <th className="p-3">Spare Part Item</th>
                    <th className="p-3">Origin Site / Source</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Pickup Date</th>
                  </>
                )}
                {isFailedLoginsCategory && (
                  <>
                    <th className="p-3">User Email / Target</th>
                    <th className="p-3">Security Event</th>
                    <th className="p-3">IP Address / Details</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Timestamp</th>
                  </>
                )}
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
              ) : isStockCategory ? (
                filteredInventoryItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 font-semibold">
                      <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      No spare parts matching selected filter <span className="font-bold text-slate-800">"{activeCardObj.title}"</span>.
                    </td>
                  </tr>
                ) : (
                  filteredInventoryItems.slice(0, 15).map((item: any) => (
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
                          onClick={() => navigate(`/stock-list?search=${encodeURIComponent(item.partCode || item.productName || '')}`)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold border border-indigo-200 transition-colors inline-flex items-center gap-1"
                        >
                          Inspect <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))
                )
              ) : isActivityCategory ? (
                filteredActivities.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 font-semibold">
                      <History className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      No audit activities recorded for <span className="font-bold text-slate-800">"{activeCardObj.title}"</span>.
                    </td>
                  </tr>
                ) : (
                  filteredActivities.slice(0, 15).map((log: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-bold text-slate-900">
                        <div>{log.userName || log.user?.name || 'System'}</div>
                        <span className="bg-indigo-100 text-indigo-800 text-[10px] px-1.5 py-0.2 rounded font-extrabold uppercase mt-0.5 inline-block">
                          {log.userRole || log.user?.role || 'SYSTEM'}
                        </span>
                      </td>
                      <td className="p-3 font-extrabold text-indigo-600">{log.action}</td>
                      <td className="p-3">
                        <span className="bg-slate-100 text-slate-800 text-[11px] px-2 py-0.5 rounded font-bold border border-slate-200">
                          {log.module || 'Inventory'} {log.entityLabel ? `· ${log.entityLabel}` : ''}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[11px]">
                        {log.oldValue && log.newValue ? (
                          <div className="flex items-center gap-1 bg-white p-1 rounded border border-slate-200">
                            <span className="text-rose-700 font-bold">{log.oldValue}</span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="text-emerald-700 font-bold">{log.newValue}</span>
                          </div>
                        ) : (
                          <span className="text-slate-600 font-medium">{log.entityLabel || 'Standard Log Entry'}</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-500 text-[11px]">
                        {new Date(log.createdAt).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))
                )
              ) : isDispatchCategory ? (
                filteredDispatches.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 font-semibold">
                      <Truck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      No dispatch records found for <span className="font-bold text-slate-800">"{activeCardObj.title}"</span>.
                    </td>
                  </tr>
                ) : (
                  filteredDispatches.slice(0, 15).map((d: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-mono font-extrabold text-blue-700">{d.dispatchNo}</td>
                      <td className="p-3 font-bold text-slate-900">{d.inventoryItem?.productName || 'Spare Part'}</td>
                      <td className="p-3 font-semibold text-slate-800">{d.site?.siteName || d.siteName || 'BHEL Site'}</td>
                      <td className="p-3"><Badge variant="warning">RESERVED</Badge></td>
                      <td className="p-3 text-right font-mono text-slate-500 text-[11px]">{new Date(d.createdAt).toLocaleString('en-IN')}</td>
                    </tr>
                  ))
                )
              ) : isPickupCategory ? (
                filteredPickups.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 font-semibold">
                      <RotateCcw className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      No pickup records found for <span className="font-bold text-slate-800">"{activeCardObj.title}"</span>.
                    </td>
                  </tr>
                ) : (
                  filteredPickups.slice(0, 15).map((p: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-mono font-extrabold text-emerald-700">{p.pickupNo}</td>
                      <td className="p-3 font-bold text-slate-900">{p.inventoryItem?.productName || 'Spare Part'}</td>
                      <td className="p-3 font-semibold text-slate-800">{p.site?.siteName || p.siteName || 'Origin Site'}</td>
                      <td className="p-3"><Badge variant="success">AVAILABLE</Badge></td>
                      <td className="p-3 text-right font-mono text-slate-500 text-[11px]">{new Date(p.createdAt).toLocaleString('en-IN')}</td>
                    </tr>
                  ))
                )
              ) : (
                filteredFailedLogins.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 font-semibold">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                      No failed login attempts recorded. System security status is 100% healthy.
                    </td>
                  </tr>
                ) : (
                  filteredFailedLogins.slice(0, 15).map((act: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-bold text-slate-900">{act.userName || 'Unknown User'}</td>
                      <td className="p-3 font-extrabold text-rose-600">{act.action}</td>
                      <td className="p-3 text-slate-600 font-mono text-[11px]">{act.entityLabel || 'Auth System'}</td>
                      <td className="p-3"><Badge variant="danger">SECURITY EVENT</Badge></td>
                      <td className="p-3 text-right font-mono text-slate-500 text-[11px]">{new Date(act.createdAt).toLocaleString('en-IN')}</td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
          {currentListLength > 15 && isStockCategory && (
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-center">
              <button
                onClick={() => navigate('/stock-list')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
              >
                View all {currentListLength} items in Stock List <ChevronRight className="w-3.5 h-3.5" />
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
                <Link
                  key={idx}
                  to={action.path}
                  className={`bg-gradient-to-r ${action.gradient} text-white rounded-xl px-3 py-2.5 flex items-center gap-2 text-xs font-bold shadow-md transition-all hover:-translate-y-0.5 active:translate-y-0`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{action.label}</span>
                </Link>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Low Stock Alert Bar & Breakdown */}
      {((dynamicLowStock?.counts?.lowStock ?? inv.lowStockCount ?? 0) > 0 || (dynamicLowStock?.counts?.outOfStock ?? inv.outOfStockCount ?? 0) > 0) && (
        <div className="mb-6 p-5 rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50/40 to-amber-50/80 border border-amber-200/90 shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100/90 flex items-center justify-center shrink-0 border border-amber-300 text-amber-600 shadow-xs">
                <AlertTriangle className="w-5 h-5 text-amber-600 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-extrabold text-amber-950">Stock Reorder Warning</p>
                  <span className="bg-amber-200 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300">
                    {dynamicLowStock?.counts?.totalWarning ?? dynamicLowStock?.lowStockItems?.length ?? data?.lowStockAlerts?.length ?? inv.lowStockCount} Part Types Affected
                  </span>
                </div>
                <p className="text-xs text-amber-800 font-medium mt-0.5">
                  <span className="font-bold text-amber-950">{dynamicLowStock?.counts?.lowStock ?? inv.lowStockCount ?? 0} item(s)</span> are running low. {(dynamicLowStock?.counts?.outOfStock ?? inv.outOfStockCount ?? 0) > 0 && <span className="font-bold text-rose-700">{(dynamicLowStock?.counts?.outOfStock ?? inv.outOfStockCount ?? 0)} item(s) are completely out of stock.</span>}
                </p>
              </div>
            </div>
          </div>

          {/* Detailed Low-Stock Parts Breakdown Table */}
          <div className="mt-4 pt-4 border-t border-amber-200/80">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-black text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  Dynamic Low-Stock &amp; Out-of-Stock Parts Breakdown ({dynamicLowStock?.counts?.lowStock ?? inv.lowStockCount ?? 0} Low Stock Items)
                </p>
                <span className="text-[11px] font-semibold text-amber-800">
                  Showing all {(dynamicLowStock?.lowStockItems || data?.lowStockAlerts || []).length} real-time low-stock part records
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-amber-200 bg-white/90 shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-amber-100 bg-amber-50/60 text-[11px] font-extrabold text-amber-900 uppercase tracking-wider">
                      <th className="p-2.5">Part ID / Code</th>
                      <th className="p-2.5">Spare Part Name</th>
                      <th className="p-2.5">OEM Vendor</th>
                      <th className="p-2.5">Store Location</th>
                      <th className="p-2.5">Current Stock</th>
                      <th className="p-2.5">Min Threshold</th>
                      <th className="p-2.5">Stock Status</th>
                      <th className="p-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100/70 text-xs text-slate-900">
                    {(dynamicLowStock?.lowStockItems || data?.lowStockAlerts || []).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-4 text-center text-amber-800 text-xs font-semibold">
                          No low stock breakdown records available.
                        </td>
                      </tr>
                    ) : (
                      (dynamicLowStock?.lowStockItems || data?.lowStockAlerts || []).map((item: any, idx: number) => {
                        const partId = item.partId || item.spareId || item.partCode || 'N/A';
                        const name = item.productName || item.partName || 'Spare Item';
                        const oem = item.oemName || 'Standard OEM';
                        const avail = item.availableQuantity ?? item.quantity ?? 0;
                        const min = item.reorderLevel || item.minStock || Math.ceil((item.totalQuantity || 10) * 0.5);
                        const storeLoc = item.store || item.location || 'Delhi';
                        const isZero = avail === 0;

                        return (
                          <tr key={idx} className="hover:bg-amber-50/50 transition-colors">
                            <td className="p-2.5 font-mono text-indigo-700 font-extrabold text-[11px]">
                              {partId}
                            </td>
                            <td className="p-2.5 font-bold text-slate-900">
                              {name}
                            </td>
                            <td className="p-2.5 font-semibold text-slate-700">
                              {oem}
                            </td>
                            <td className="p-2.5">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${storeLoc.toLowerCase().includes('delhi') ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-orange-50 text-orange-800 border-orange-200'}`}>
                                <MapPin className="w-3 h-3" />
                                {storeLoc}
                              </span>
                            </td>
                            <td className="p-2.5 font-black">
                              <span className={isZero ? 'text-rose-700' : 'text-amber-700'}>
                                {avail} {item.unit || 'PCS'}
                              </span>
                            </td>
                            <td className="p-2.5 font-semibold text-slate-600">
                              {min} {item.unit || 'PCS'}
                            </td>
                            <td className="p-2.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${isZero ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-amber-100 text-amber-800 border-amber-300'}`}>
                                {isZero ? 'OUT OF STOCK' : 'LOW STOCK'}
                              </span>
                            </td>
                            <td className="p-2.5 text-right">
                              <button
                                onClick={() => navigate(`/stock-list?search=${encodeURIComponent(item.partCode || name)}`)}
                                className="px-2.5 py-1 rounded-lg bg-amber-600 text-white hover:bg-amber-700 text-[11px] font-bold transition-all shadow-xs inline-flex items-center gap-1"
                              >
                                View Part <ChevronRight className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
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
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
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
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
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

        {/* Live Activity Feed / Timeline */}
        <div className="lg:col-span-2">
          <Card title="Recent Activity Timeline" subtitle="Audit logs & change history" action={
            <button onClick={() => navigate('/activity')} className="text-xs text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1">
              Full Activity Log <ChevronRight className="w-3 h-3" />
            </button>
          }>
            <div className="space-y-2 mt-1 max-h-60 overflow-y-auto pr-1">
              {(data?.recentActivities || []).length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6 font-medium">No recent activity recorded</p>
              ) : (
                (data?.recentActivities || []).map((log: any, i: number) => {
                  const userName = log.userName || log.user?.name || 'System';
                  const userRole = log.userRole || log.user?.role || 'SYSTEM';
                  return (
                    <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition-colors shadow-2xs">
                      <Activity className="w-3.5 h-3.5 text-indigo-600 mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs">{userName}</span>
                          <span className="bg-indigo-100 text-indigo-800 text-[10px] px-1.5 py-0.2 rounded font-extrabold uppercase">{userRole}</span>
                          <span className="text-slate-400 text-xs">•</span>
                          <span className="font-bold text-indigo-600 text-xs">{log.action}</span>
                          {log.module && <span className="bg-slate-200 text-slate-800 text-[10px] px-1.5 rounded font-bold">{log.module}</span>}
                        </div>
                        {log.entityLabel && <p className="text-xs text-slate-700 font-medium mt-0.5">{log.entityLabel}</p>}
                        {log.oldValue && log.newValue && (
                          <p className="text-[11px] text-slate-600 font-mono mt-1 bg-white p-1.5 rounded border border-slate-200">
                            <span className="text-rose-700 font-bold">{log.oldValue}</span>
                            <ArrowRight className="w-3 h-3 inline mx-1 text-slate-400" />
                            <span className="text-emerald-700 font-bold">{log.newValue}</span>
                          </p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-1 font-mono">{new Date(log.createdAt).toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  );
                })
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
        <Card title="Low Stock Monitoring (<= 50% Stock Available)">
          <div className="space-y-2 mt-1">
            {(data?.lowStockAlerts || []).length === 0
              ? <div className="flex flex-col items-center py-6 gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                <p className="text-xs font-bold text-slate-700">All inventory levels healthy</p>
              </div>
              : (data?.lowStockAlerts || []).map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 border border-amber-200/80">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      <span className="font-mono text-indigo-700 font-bold mr-1.5">{item.partCode}</span>
                      {item.productName}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">{item.oemName || item.oem?.name}</p>
                  </div>
                  <span className={`text-[11px] font-mono font-extrabold px-2.5 py-1 rounded-lg shrink-0 ${item.availableQuantity === 0 ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-amber-100 text-amber-800 border border-amber-300'}`}>
                    {item.availableQuantity === 0 ? '0 Out of Stock' : `${item.availableQuantity} / ${item.totalQuantity} (${item.percentRemaining}%)`}
                  </span>
                </div>
              ))}
          </div>
        </Card>
      </div>

      {/* 3. LOW STOCK BREAKDOWN MODAL POPUP */}
      {isStockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]">

            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-amber-50/80 via-orange-50/40 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0 shadow-xs">
                  <AlertTriangle className="w-5 h-5 text-amber-600 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Low Stock Devices Breakdown</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Listing all parts currently requiring reorder attention ({((dynamicLowStock?.lowStockItems || []) as any[]).length + ((dynamicLowStock?.outOfStockItems || []) as any[]).length} items total)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsStockModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center text-lg transition-colors cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Table View of Low Stock Items */}
            <div className="p-5 overflow-y-auto flex-1">
              {isLoadingDynamic ? (
                <div className="text-center py-12 text-slate-400 text-sm font-semibold flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  Fetching live stock breakdown data...
                </div>
              ) : (dynamicLowStock?.lowStockItems || []).length === 0 && (dynamicLowStock?.outOfStockItems || []).length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm font-semibold flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                  All inventory items are sufficiently stocked!
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 font-extrabold border-b border-slate-200">
                        <th className="p-3">#</th>
                        <th className="p-3">Part ID</th>
                        <th className="p-3">Part Name / Device</th>
                        <th className="p-3">Category / OEM</th>
                        <th className="p-3 text-center">Available Stock</th>
                        <th className="p-3 text-center">Min Level</th>
                        <th className="p-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-900">
                      {/* Out of stock items */}
                      {(dynamicLowStock?.outOfStockItems || []).map((item: any, idx: number) => {
                        const partId = item.partId || item.spareId || item.partCode || 'N/A';
                        const name = item.productName || item.partName || 'Spare Item';
                        const category = item.category || item.oemName || 'General';
                        const min = item.reorderLevel || item.minStock || 5;

                        return (
                          <tr key={`out-${idx}`} className="bg-rose-50/50 hover:bg-rose-100/50 transition-colors">
                            <td className="p-3 text-slate-400 font-bold">{idx + 1}</td>
                            <td className="p-3 font-mono font-extrabold text-rose-900">{partId}</td>
                            <td className="p-3 font-bold text-slate-900">{name}</td>
                            <td className="p-3 text-slate-600 font-medium">{category}</td>
                            <td className="p-3 text-center font-black text-rose-700">0</td>
                            <td className="p-3 text-center text-slate-600 font-semibold">{min}</td>
                            <td className="p-3 text-right">
                              <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-black text-[10px] uppercase border border-rose-300">
                                OUT OF STOCK
                              </span>
                            </td>
                          </tr>
                        );
                      })}

                      {/* Low stock items */}
                      {(dynamicLowStock?.lowStockItems || []).map((item: any, idx: number) => {
                        const partId = item.partId || item.spareId || item.partCode || 'N/A';
                        const name = item.productName || item.partName || 'Spare Item';
                        const category = item.category || item.oemName || 'General';
                        const avail = item.quantity ?? item.availableQuantity ?? 0;
                        const min = item.reorderLevel || item.minStock || 5;

                        return (
                          <tr key={`low-${idx}`} className="hover:bg-amber-50/40 transition-colors">
                            <td className="p-3 text-slate-400 font-bold">{(dynamicLowStock?.outOfStockItems || []).length + idx + 1}</td>
                            <td className="p-3 font-mono font-extrabold text-amber-900">{partId}</td>
                            <td className="p-3 font-bold text-slate-900">{name}</td>
                            <td className="p-3 text-slate-600 font-medium">{category}</td>
                            <td className="p-3 text-center font-black text-amber-700">{avail}</td>
                            <td className="p-3 text-center text-slate-600 font-semibold">{min}</td>
                            <td className="p-3 text-right">
                              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-black text-[10px] uppercase border border-amber-300">
                                LOW STOCK
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
              <span className="text-xs text-slate-500 font-medium">
                Total Low Stock Parts: <strong className="text-slate-900 font-extrabold font-mono">{(dynamicLowStock?.lowStockItems || []).length + (dynamicLowStock?.outOfStockItems || []).length}</strong>
              </span>
              <button
                type="button"
                onClick={() => setIsStockModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
