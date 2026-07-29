import React, { useState } from 'react';
import {
  FileSpreadsheet, Download, FileText, BarChart2,
  Package, Truck, RotateCcw, AlertTriangle, Calendar,
  Building2, MapPin, Activity, Shield,
} from 'lucide-react';
import { Layout } from '../../components/layout';
import { Card, Button } from '../../components/ui';
import api from '../../api';

interface ReportDef {
  key: string;
  title: string;
  desc: string;
  icon: React.ElementType;
  color: string;
  category: string;
  params?: Record<string, string>;
  hasDateFilter?: boolean;
  hasStoreFilter?: boolean;
  hasOEMFilter?: boolean;
}

const REPORTS: ReportDef[] = [
  // Inventory Reports
  {
    key: 'full-inventory',
    title: 'Full Inventory Report',
    desc: 'Complete list of all spare items with OEM, stock levels, location, and status.',
    icon: Package,
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    category: 'Inventory',
    hasStoreFilter: true,
  },
  {
    key: 'low-stock',
    title: 'Low Stock & Reorder Alert',
    desc: 'Items with available quantity ≤ 2 requiring stock replenishment.',
    icon: AlertTriangle,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    category: 'Inventory',
    hasStoreFilter: true,
  },
  {
    key: 'out-of-stock',
    title: 'Out of Stock Report',
    desc: 'All spare items currently with zero available quantity.',
    icon: AlertTriangle,
    color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    category: 'Inventory',
  },
  {
    key: 'oem-wise-stock',
    title: 'OEM-wise Stock Report',
    desc: 'Stock inventory grouped and summarized by OEM/manufacturer.',
    icon: BarChart2,
    color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    category: 'Inventory',
  },
  // Movement Reports
  {
    key: 'dispatch-activity',
    title: 'Dispatch Activity Report',
    desc: 'Historical record of all dispatches with tracking, site, and courier details.',
    icon: Truck,
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    category: 'Movements',
    hasDateFilter: true,
  },
  {
    key: 'pickup-activity',
    title: 'Pickup Activity Report',
    desc: 'All pickup records including fault descriptions and return confirmation status.',
    icon: RotateCcw,
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    category: 'Movements',
    hasDateFilter: true,
  },
  {
    key: 'movement-history',
    title: 'Full Movement History',
    desc: 'Complete audit trail of all stock movements — imports, dispatches, pickups, adjustments.',
    icon: Activity,
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    category: 'Movements',
    hasDateFilter: true,
  },
  // Site / BHEL Reports
  {
    key: 'site-wise-dispatch',
    title: 'Site-wise Dispatch Report',
    desc: 'Dispatch activity broken down by BHEL site with totals and contact details.',
    icon: Building2,
    color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    category: 'BHEL Sites',
    hasDateFilter: true,
  },
  {
    key: 'site-master',
    title: 'BHEL Site Master List',
    desc: 'Complete list of BHEL sites with SPOC/contact details, region, and PO details.',
    icon: MapPin,
    color: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
    category: 'BHEL Sites',
  },
  // Compliance / Warranty
  {
    key: 'warranty-expiry',
    title: 'Warranty Expiry Report',
    desc: 'Spares with warranty expiring within configurable window (30/60/90 days).',
    icon: Shield,
    color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    category: 'Compliance',
    hasDateFilter: true,
  },
];

const categories = ['Inventory', 'Movements', 'BHEL Sites', 'Compliance'];

export const ReportsPage: React.FC = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const [filterStore, setFilterStore] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [warrantyDays, setWarrantyDays] = useState('30');

  const download = async (reportKey: string, format: 'excel' | 'pdf' | 'csv') => {
    setLoading(`${reportKey}-${format}`);
    try {
      const params: Record<string, string> = { format };
      if (filterStore) params.store = filterStore;
      if (filterDateFrom) params.from = filterDateFrom;
      if (filterDateTo) params.to = filterDateTo;
      if (reportKey === 'warranty-expiry') params.days = warrantyDays;

      const res = await api.get(`/reports/${reportKey}`, {
        params,
        responseType: 'blob',
      });

      const ext = format === 'pdf' ? 'pdf' : format === 'csv' ? 'csv' : 'xlsx';
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportKey}-${new Date().toISOString().split('T')[0]}.${ext}`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Report download failed:', e);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Layout title="Reports & Data Export Center">
      {/* Global Filters */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1">Store Filter</label>
            <select value={filterStore} onChange={(e) => setFilterStore(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500 min-w-32">
              <option value="">All Stores</option>
              <option value="Delhi">Delhi</option>
              <option value="Bengaluru">Bengaluru</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1">Date From</label>
            <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500" />
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1">Date To</label>
            <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500" />
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1">Warranty Window (Days)</label>
            <select value={warrantyDays} onChange={(e) => setWarrantyDays(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500">
              <option value="30">30 Days</option>
              <option value="60">60 Days</option>
              <option value="90">90 Days</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Reports by Category */}
      {categories.map((cat) => {
        const catReports = REPORTS.filter(r => r.category === cat);
        return (
          <div key={cat} className="mb-7">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-6 h-px bg-brand-500" />
              {cat} Reports
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {catReports.map((rep) => {
                const Icon = rep.icon;
                return (
                  <div
                    key={rep.key}
                    className="glass-panel rounded-xl p-5 border border-slate-800/80 shadow-lg hover:border-slate-700 transition-all"
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${rep.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-100 text-sm">{rep.title}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{rep.desc}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-slate-800">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />}
                        isLoading={loading === `${rep.key}-excel`}
                        onClick={() => download(rep.key, 'excel')}
                      >
                        Excel (.xlsx)
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<FileText className="w-3.5 h-3.5 text-rose-400" />}
                        isLoading={loading === `${rep.key}-pdf`}
                        onClick={() => download(rep.key, 'pdf')}
                      >
                        PDF Report
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Download className="w-3.5 h-3.5 text-blue-400" />}
                        isLoading={loading === `${rep.key}-csv`}
                        onClick={() => download(rep.key, 'csv')}
                      >
                        CSV
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </Layout>
  );
};
