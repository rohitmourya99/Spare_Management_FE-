import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../api';
import { Layout } from '../../components/layout';
import { Card, Badge } from '../../components/ui';
import { ActivityLog } from '../../types';

export const ActivityLogPage: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['activity-logs'],
    queryFn: async () => (await api.get('/activity')).data.data,
  });

  const logs: ActivityLog[] = data || [];

  return (
    <Layout title="System Activity & Audit Log">
      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm data-table">
            <thead>
              <tr>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">User</th>
                <th className="p-3.5">Action</th>
                <th className="p-3.5">Entity</th>
                <th className="p-3.5">Target Label</th>
                <th className="p-3.5">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-900">
              {isLoading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-500 font-semibold">Loading activity logs...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-500 font-semibold">No activity logs recorded yet.</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-mono text-xs text-slate-700 font-semibold whitespace-nowrap">{new Date(log.createdAt).toLocaleString('en-IN')}</td>
                    <td className="p-3.5 font-bold text-slate-900">{log.user?.name || log.userId}</td>
                    <td className="p-3.5"><Badge variant={log.action === 'LOGIN' ? 'success' : log.action === 'DELETE' ? 'danger' : 'info'}>{log.action}</Badge></td>
                    <td className="p-3.5 text-xs text-slate-800 font-medium">{log.entity}</td>
                    <td className="p-3.5 text-xs font-mono text-indigo-600 font-bold">{log.entityLabel || '-'}</td>
                    <td className="p-3.5 font-mono text-xs text-slate-600 font-semibold">{log.ipAddress || '127.0.0.1'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </Layout>
  );
};
