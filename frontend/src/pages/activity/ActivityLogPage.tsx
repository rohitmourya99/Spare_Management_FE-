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
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/80 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">User</th>
                <th className="p-3.5">Action</th>
                <th className="p-3.5">Entity</th>
                <th className="p-3.5">Target Label</th>
                <th className="p-3.5">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {isLoading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading activity logs...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-500">No activity logs recorded yet.</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 font-mono text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="p-3.5 font-semibold text-slate-200">{log.user?.name || log.userId}</td>
                    <td className="p-3.5"><Badge variant={log.action === 'LOGIN' ? 'success' : log.action === 'DELETE' ? 'danger' : 'info'}>{log.action}</Badge></td>
                    <td className="p-3.5 text-xs text-slate-300">{log.entity}</td>
                    <td className="p-3.5 text-xs font-mono text-brand-400">{log.entityLabel || '-'}</td>
                    <td className="p-3.5 font-mono text-xs text-slate-500">{log.ipAddress || '127.0.0.1'}</td>
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
