import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search, X, Download, RefreshCw, History, Filter, ArrowRight,
  FileSpreadsheet, FileText, Calendar, ShieldCheck, Tag
} from 'lucide-react';
import api from '../../api';
import { Layout } from '../../components/layout';
import { Card, Button, Badge } from '../../components/ui';
import { ActivityLog } from '../../types';

export const ActivityLogPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

  const params: any = {
    search,
    module: moduleFilter || undefined,
    role: roleFilter || undefined,
    from: fromDate || undefined,
    to: toDate || undefined,
    page,
    limit: 15,
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['activity-logs', params],
    queryFn: async () => (await api.get('/activity', { params })).data,
  });

  const logs: ActivityLog[] = data?.data || [];
  const pagination = data?.pagination;

  const handleExport = async (format: 'excel' | 'pdf' | 'csv') => {
    try {
      const exportParams = { ...params, format };
      delete exportParams.page;
      delete exportParams.limit;

      const res = await api.get('/activity/export', {
        params: exportParams,
        responseType: 'blob',
      });

      const ext = format === 'pdf' ? 'pdf' : format === 'csv' ? 'csv' : 'xlsx';
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Activity_Logs_${new Date().toISOString().split('T')[0]}.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  return (
    <Layout title="System Activity & Audit Log Trail">
      {/* Search & Filter Header */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl mb-5">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search User, Action, Part Code, Serial, Site..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 font-medium"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Module Filter */}
          <select
            value={moduleFilter}
            onChange={(e) => { setModuleFilter(e.target.value); setPage(1); }}
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:border-indigo-600"
          >
            <option value="">All Audit Modules</option>
            <option value="Inventory">Inventory</option>
            <option value="Dispatch">Dispatch</option>
            <option value="Pickup">Pickup &amp; OEM</option>
            <option value="Reports">Reports</option>
            <option value="Import">Import</option>
            <option value="Site Master">Site Master</option>
            <option value="User Management">User Management</option>
            <option value="Authentication">Authentication</option>
          </select>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:border-indigo-600"
          >
            <option value="">All Roles</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="INVENTORY_ADMIN">Inventory Admin</option>
            <option value="ENGINEER">Field Engineer</option>
          </select>

          {/* Date Range */}
          <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl px-2 py-1 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="text-xs text-slate-800 focus:outline-none"
            />
            <span className="text-slate-400 font-bold">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="text-xs text-slate-800 focus:outline-none"
            />
          </div>
        </div>

        {/* Export Options */}
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => handleExport('excel')} icon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />}>
            Excel
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleExport('pdf')} icon={<FileText className="w-3.5 h-3.5 text-rose-600" />}>
            PDF
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleExport('csv')} icon={<Download className="w-3.5 h-3.5 text-indigo-600" />}>
            CSV
          </Button>
        </div>
      </div>

      {/* Activity Logs Table */}
      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap data-table">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <th className="p-3.5">Date &amp; Time</th>
                <th className="p-3.5">User Details</th>
                <th className="p-3.5">Module</th>
                <th className="p-3.5">Action</th>
                <th className="p-3.5">Entity / Item Details</th>
                <th className="p-3.5">Change History (Old → New)</th>
                <th className="p-3.5">Remarks &amp; IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-900">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-semibold">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                    Loading system audit log trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-semibold">
                    <History className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                    No activity logs recorded matching the selected filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const userName = log.userName || log.user?.name || 'System';
                  const userRole = log.userRole || log.user?.role || 'SYSTEM';
                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5 font-mono text-slate-700 font-semibold">
                        {new Date(log.createdAt).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3.5">
                        <p className="font-bold text-slate-900">{userName}</p>
                        <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
                          {userRole}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className="bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                          {log.module || log.entity || 'System'}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-indigo-700">
                        {log.action}
                      </td>
                      <td className="p-3.5">
                        <p className="font-bold text-slate-900">{log.entityLabel || '-'}</p>
                        {log.partCode && <p className="text-[11px] font-mono text-indigo-600">Part: {log.partCode}</p>}
                        {log.serialNumber && <p className="text-[11px] font-mono text-emerald-600">SN: {log.serialNumber}</p>}
                        {log.siteName && <p className="text-[11px] text-slate-500">Site: {log.siteName}</p>}
                      </td>
                      <td className="p-3.5 max-w-xs">
                        {log.oldValue || log.newValue ? (
                          <div className="bg-white p-2 rounded-lg border border-slate-200 space-y-1 text-[11px] font-mono whitespace-normal">
                            {log.oldValue && <p className="text-rose-700 font-medium"><span className="font-bold text-slate-500">OLD:</span> {log.oldValue}</p>}
                            {log.newValue && <p className="text-emerald-700 font-medium"><span className="font-bold text-slate-500">NEW:</span> {log.newValue}</p>}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-normal italic">-</span>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-600 text-[11px]">
                        <p className="font-medium">{log.remarks || '-'}</p>
                        <p className="font-mono text-slate-400 mt-0.5">{log.ipAddress || '127.0.0.1'}</p>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
            <p className="text-xs text-slate-600 font-medium">
              Showing {((page - 1) * 15) + 1}–{Math.min(page * 15, pagination.total)} of {pagination.total} audit logs
            </p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                Prev
              </Button>
              <span className="text-xs text-slate-800 font-bold px-2">{page} / {pagination.totalPages}</span>
              <Button variant="secondary" size="sm" disabled={!pagination.hasNext} onClick={() => setPage(p => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </Layout>
  );
};
