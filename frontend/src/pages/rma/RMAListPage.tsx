import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wrench, Plus, Search, RefreshCw, X, ShieldAlert, CheckCircle2, Clock } from 'lucide-react';
import api from '../../api';
import { Layout } from '../../components/layout';
import { Button, Card, Badge, Modal } from '../../components/ui';
import { RMA, InventoryItem } from '../../types';

const statusVariant = (s: string): 'success' | 'danger' | 'warning' | 'info' | 'default' => {
  if (s === 'CLOSED' || s === 'REPLACEMENT_RECEIVED') return 'success';
  if (s === 'REJECTED') return 'danger';
  if (s === 'SENT' || s === 'APPROVED') return 'info';
  return 'warning';
};

export const RMAListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const [form, setForm] = useState({
    inventoryItemId: '',
    oemTicketNo: '',
    reason: '',
    remarks: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['rmas', search],
    queryFn: async () => {
      const res = await api.get('/rma', { params: { search } });
      return res.data;
    },
  });

  const { data: itemsData } = useQuery({
    queryKey: ['inventory-search-rma', itemSearch],
    queryFn: async () => {
      const res = await api.get('/inventory', { params: { search: itemSearch, limit: 10 } });
      return res.data.data as InventoryItem[];
    },
    enabled: isModalOpen && itemSearch.length > 0,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const res = await api.post('/rma', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rmas'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setIsModalOpen(false);
      resetForm();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api.put(`/rma/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rmas'] });
    },
  });

  const resetForm = () => {
    setForm({ inventoryItemId: '', oemTicketNo: '', reason: '', remarks: '' });
    setSelectedItem(null);
    setItemSearch('');
  };

  const handleSubmit = () => {
    if (!form.inventoryItemId) return;
    createMutation.mutate(form);
  };

  const rmas: RMA[] = data?.data || [];

  return (
    <Layout title="RMA Module (Return Merchandise Authorization)">
      <div className="flex items-center justify-between mb-5">
        <div className="relative w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search RMA ticket, OEM, Spare..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>
        <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setIsModalOpen(true)}>
          Raise New RMA
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/80 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3.5">RMA Ticket No</th>
                <th className="p-3.5">Spare Item</th>
                <th className="p-3.5">OEM</th>
                <th className="p-3.5">OEM Case / Ticket No</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Created Date</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {isLoading ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-500" />
                  Loading RMA tickets...
                </td></tr>
              ) : rmas.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-500">
                  <Wrench className="w-8 h-8 mx-auto mb-2 text-slate-700" />
                  No RMA tickets found.
                </td></tr>
              ) : (
                rmas.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3.5 font-mono text-xs text-amber-400 font-semibold whitespace-nowrap">{r.rmaNo}</td>
                    <td className="p-3.5">
                      <p className="font-semibold text-slate-100">{r.inventoryItem?.productName}</p>
                      <p className="text-xs text-slate-500 font-mono">{r.inventoryItem?.spareId}</p>
                    </td>
                    <td className="p-3.5 font-medium text-white">{r.inventoryItem?.oem?.name}</td>
                    <td className="p-3.5 font-mono text-xs text-slate-300">{r.oemTicketNo || '—'}</td>
                    <td className="p-3.5"><Badge variant={statusVariant(r.status)}>{r.status}</Badge></td>
                    <td className="p-3.5 text-xs text-slate-400 whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="p-3.5 text-right">
                      {r.status !== 'CLOSED' && r.status !== 'REJECTED' && (
                        <select
                          value={r.status}
                          onChange={(e) => updateStatusMutation.mutate({ id: r.id, status: e.target.value })}
                          className="text-xs bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-brand-500"
                        >
                          <option value="RAISED">RAISED</option>
                          <option value="APPROVED">APPROVED</option>
                          <option value="SENT">SENT TO OEM</option>
                          <option value="REPLACEMENT_RECEIVED">REPLACEMENT RECEIVED</option>
                          <option value="CLOSED">CLOSED</option>
                          <option value="REJECTED">REJECTED</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* New RMA Modal */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title="Raise OEM RMA Ticket" maxWidth="md">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Select Faulty Spare Part *</label>
            {selectedItem ? (
              <div className="p-3 rounded-xl bg-slate-900 border border-brand-500/30 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{selectedItem.productName}</p>
                  <p className="text-xs text-slate-400">{selectedItem.spareId} · OEM: {selectedItem.oem?.name}</p>
                </div>
                <button onClick={() => { setSelectedItem(null); setForm(f => ({ ...f, inventoryItemId: '' })); }}>
                  <X className="w-4 h-4 text-slate-400 hover:text-rose-400" />
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  placeholder="Search spare..."
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
                {itemsData && itemsData.length > 0 && itemSearch && (
                  <div className="mt-1 bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
                    {itemsData.map((item) => (
                      <button key={item.id} onClick={() => { setSelectedItem(item); setForm(f => ({ ...f, inventoryItemId: item.id })); setItemSearch(''); }}
                        className="w-full text-left px-3 py-2.5 hover:bg-slate-800 border-b border-slate-800 last:border-0">
                        <p className="text-sm font-medium text-white">{item.productName}</p>
                        <p className="text-xs text-slate-400">{item.oem?.name} · {item.spareId}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">OEM Case / Ticket Number</label>
            <input
              type="text"
              placeholder="e.g. TAC-10928374"
              value={form.oemTicketNo}
              onChange={(e) => setForm(f => ({ ...f, oemTicketNo: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Reason for RMA / Fault Details</label>
            <textarea
              rows={3}
              placeholder="Describe hardware failure, error codes, port breakdown..."
              value={form.reason}
              onChange={(e) => setForm(f => ({ ...f, reason: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Remarks</label>
            <textarea
              rows={2}
              placeholder="Additional notes..."
              value={form.remarks}
              onChange={(e) => setForm(f => ({ ...f, remarks: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-slate-800">
            <Button variant="secondary" onClick={() => { setIsModalOpen(false); resetForm(); }}>Cancel</Button>
            <Button variant="primary" icon={<Wrench className="w-4 h-4" />} onClick={handleSubmit} isLoading={createMutation.isPending} disabled={!form.inventoryItemId}>
              Raise RMA Ticket
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
};
