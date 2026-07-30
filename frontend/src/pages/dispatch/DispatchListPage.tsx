import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Truck, Plus, Search, CheckCircle2, X, RefreshCw,
  Building2, MapPin, User, Phone, Mail, Eye, Tag, Cpu, Clock, Calendar, Hash,
} from 'lucide-react';
import api from '../../api';
import { Layout } from '../../components/layout';
import { Button, Card, Badge, Modal } from '../../components/ui';
import { Site, InventoryItem } from '../../types';

const statusVariant = (s: string): 'success' | 'danger' | 'warning' | 'info' | 'default' =>
  s === 'DISPATCHED' ? 'danger' : s === 'APPROVED' ? 'warning' : s === 'CANCELLED' ? 'default' : 'info';

// Helper function to format live Date & Time
const formatDateTime = (dispatchDateVal?: string | Date, createdAtVal?: string | Date) => {
  let d = dispatchDateVal ? new Date(dispatchDateVal) : null;
  if (!d || isNaN(d.getTime()) || (d.getHours() === 0 && d.getMinutes() === 0 && createdAtVal)) {
    if (createdAtVal) d = new Date(createdAtVal);
  }
  if (!d || isNaN(d.getTime())) return { date: 'Live Date', time: '' };

  const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return { date, time };
};

export const DispatchListPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const [detailsDispatch, setDetailsDispatch] = useState<any | null>(null);

  const [form, setForm] = useState({
    inventoryItemId: '',
    siteId: '',
    quantity: 1,
    courierName: '',
    trackingNo: '',
    dispatchDate: new Date().toISOString().split('T')[0],
    expectedDelivery: '',
    remarks: '',
  });

  const preItemId = searchParams.get('itemId');
  useEffect(() => {
    if (preItemId) {
      api.get(`/inventory/${preItemId}`).then((res) => {
        const item = res.data.data;
        setSelectedItem(item);
        setForm(f => ({ ...f, inventoryItemId: item.id }));
        setIsModalOpen(true);
      });
    }
  }, [preItemId]);

  const { data, isLoading } = useQuery({
    queryKey: ['dispatches', search],
    queryFn: async () => {
      const res = await api.get('/dispatch', { params: { search } });
      return res.data;
    },
  });

  const { data: sitesData } = useQuery({
    queryKey: ['sites-dropdown'],
    queryFn: async () => {
      const res = await api.get('/sites/dropdown');
      return res.data.data as Site[];
    },
  });

  const { data: itemsData } = useQuery({
    queryKey: ['inventory-search-dispatch', itemSearch],
    queryFn: async () => {
      const res = await api.get('/inventory', { params: { search: itemSearch, limit: 10 } });
      return res.data.data as InventoryItem[];
    },
    enabled: isModalOpen && itemSearch.length > 0,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const res = await api.post('/dispatch', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatches'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setIsModalOpen(false);
      resetForm();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/dispatch/${id}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatches'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });

  const resetForm = () => {
    setForm({
      inventoryItemId: '', siteId: '', quantity: 1, courierName: '',
      trackingNo: '', dispatchDate: new Date().toISOString().split('T')[0], expectedDelivery: '', remarks: '',
    });
    setSelectedItem(null);
    setSelectedSite(null);
    setItemSearch('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.inventoryItemId || !form.siteId) return;
    createMutation.mutate(form);
  };

  const handleSelectSite = (siteId: string) => {
    setForm(f => ({ ...f, siteId }));
    const found = (sitesData || []).find(s => s.id === siteId) || null;
    setSelectedSite(found);
  };

  const dispatches: any[] = data?.data || [];

  return (
    <Layout title="Outbound Dispatches">
      {/* Top Header & Search */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search dispatch no, site, courier, AWB..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 font-medium"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setIsModalOpen(true)}>
          Create New Dispatch
        </Button>
      </div>

      {/* Dispatches Table */}
      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm data-table">
            <thead>
              <tr>
                <th className="p-3.5">Dispatch No</th>
                <th className="p-3.5">Spare Item</th>
                <th className="p-3.5">Serial Number</th>
                <th className="p-3.5">BHEL Site &amp; Class</th>
                <th className="p-3.5">SPOC Contact</th>
                <th className="p-3.5 text-center">Qty</th>
                <th className="p-3.5">Courier / Tracking</th>
                <th className="p-3.5">Dispatch Date &amp; Time</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-900">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    <span className="text-sm font-semibold">Loading dispatches...</span>
                  </td>
                </tr>
              ) : dispatches.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-slate-500 font-semibold">
                    <Truck className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                    No dispatch records found.
                  </td>
                </tr>
              ) : (
                dispatches.map((d) => {
                  const { date, time } = formatDateTime(d.dispatchDate, d.createdAt);

                  return (
                    <tr
                      key={d.id}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => setDetailsDispatch(d)}
                    >
                      {/* Dispatch No */}
                      <td className="p-3.5 font-mono text-xs text-indigo-600 font-black whitespace-nowrap">
                        {d.dispatchNo}
                      </td>

                      {/* Spare Item & OEM */}
                      <td className="p-3.5">
                        <p className="font-bold text-slate-900 text-xs">{d.inventoryItem?.productName || 'Spare Item'}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 font-medium">
                          <Cpu className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{d.inventoryItem?.oem?.name || 'Standard OEM'}</span>
                        </p>
                      </td>

                      {/* Serial Number (Locked Dispatched Serial) */}
                      <td className="p-3.5 font-mono text-xs whitespace-nowrap">
                        {(d as any).originalSerialNumber || d.inventoryItem?.serialNumber ? (
                          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 font-bold">
                            {(d as any).originalSerialNumber || d.inventoryItem?.serialNumber}
                          </span>
                        ) : (
                          <span className="text-slate-600 italic text-[11px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-medium">
                            Bulk Item
                          </span>
                        )}
                      </td>

                      {/* BHEL Site & Location Class */}
                      <td className="p-3.5">
                        <p className="font-bold text-slate-900 text-xs">{d.site?.siteName || 'Destination Site'}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {d.site?.city && (
                            <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-bold border border-slate-200">
                              {d.site?.city}
                            </span>
                          )}
                          {d.site?.locationClass && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200 font-bold">
                              Class {d.site?.locationClass}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* SPOC Contact */}
                      <td className="p-3.5 text-xs">
                        <p className="font-bold text-slate-900">{d.site?.contactPerson || 'Site SPOC'}</p>
                        {d.site?.phone && <p className="text-slate-600 font-mono text-[11px] font-semibold mt-0.5">{d.site?.phone}</p>}
                      </td>

                      {/* Qty */}
                      <td className="p-3.5 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-100 text-slate-900 border border-slate-300">
                          {d.quantity}
                        </span>
                      </td>

                      {/* Courier / Tracking AWB */}
                      <td className="p-3.5 text-xs">
                        <p className="text-slate-900 font-bold">{d.courierName || 'Courier Direct'}</p>
                        {d.trackingNo ? (
                          <p className="font-mono text-[11px] text-indigo-600 font-bold">#{d.trackingNo}</p>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic">No AWB logged</p>
                        )}
                      </td>

                      {/* Dispatch Date & Time (Stacked) */}
                      <td className="p-3.5 text-xs whitespace-nowrap">
                        <p className="font-bold text-slate-900 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-indigo-600 shrink-0" />
                          {date}
                        </p>
                        <p className="text-[11px] text-slate-600 font-mono font-semibold flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                          {time}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="p-3.5">
                        <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setDetailsDispatch(d)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-600 text-slate-700 hover:text-white border border-slate-200 transition-colors"
                            title="View Full Location, Date/Time & SPOC Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {d.status !== 'CANCELLED' && (
                            <Button
                              size="xs"
                              variant="secondary"
                              onClick={() => cancelMutation.mutate(d.id)}
                              isLoading={cancelMutation.isPending}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Full Location, Date/Time & SPOC Details Modal */}
      <Modal isOpen={!!detailsDispatch} onClose={() => setDetailsDispatch(null)} title="Dispatch Log Details" maxWidth="lg">
        {detailsDispatch && (
          <div className="space-y-4">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">{detailsDispatch.inventoryItem?.productName}</p>
                <p className="text-xs text-indigo-600 font-mono font-bold mt-0.5">
                  SN: {detailsDispatch.inventoryItem?.serialNumber || 'Bulk Unit'} · OEM: {detailsDispatch.inventoryItem?.oem?.name || 'Standard OEM'}
                </p>
              </div>
              <Badge variant={statusVariant(detailsDispatch.status)}>{detailsDispatch.status}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p className="text-slate-500 font-semibold text-[10px]">Dispatch Reference No</p>
                <p className="font-mono font-extrabold text-indigo-600 text-sm mt-0.5">{detailsDispatch.dispatchNo}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p className="text-slate-500 font-semibold text-[10px]">Dispatch Date &amp; Live Time</p>
                <p className="font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  {formatDateTime(detailsDispatch.dispatchDate, detailsDispatch.createdAt).date}{' '}
                  <span className="text-slate-500 font-mono font-semibold">({formatDateTime(detailsDispatch.dispatchDate, detailsDispatch.createdAt).time})</span>
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 col-span-2">
                <p className="text-slate-500 font-semibold text-[10px] uppercase tracking-wider flex items-center gap-1 mb-1">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" /> Destination BHEL Site Location
                </p>
                <p className="font-bold text-slate-900 text-sm">{detailsDispatch.site?.siteName}</p>
                <p className="text-slate-600 mt-0.5 font-medium">{detailsDispatch.site?.fullAddress || `${detailsDispatch.site?.city}, ${detailsDispatch.site?.state}`}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold border border-indigo-200">
                    Location Class {detailsDispatch.site?.locationClass}
                  </span>
                  <span className="bg-slate-200 text-slate-800 px-2 py-0.5 rounded text-[10px] font-bold">
                    {detailsDispatch.site?.city}, {detailsDispatch.site?.state}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p className="text-slate-500 font-semibold text-[10px]">Site SPOC Contact</p>
                <p className="font-bold text-slate-900 mt-0.5">{detailsDispatch.site?.contactPerson || 'N/A'}</p>
                <p className="text-slate-600 font-mono font-semibold mt-0.5">{detailsDispatch.site?.phone || 'N/A'}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p className="text-slate-500 font-semibold text-[10px]">Courier &amp; AWB Tracking</p>
                <p className="font-bold text-slate-900 mt-0.5">{detailsDispatch.courierName || 'Courier Direct'}</p>
                <p className="font-mono text-indigo-600 font-bold mt-0.5">#{detailsDispatch.trackingNo || 'No AWB'}</p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <Button variant="secondary" size="sm" onClick={() => setDetailsDispatch(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create New Dispatch Modal */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title="Create Outbound Dispatch" maxWidth="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">Select Stock Item to Dispatch *</label>
            {selectedItem ? (
              <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                <div>
                  <p className="text-xs font-bold text-indigo-950">{selectedItem.productName}</p>
                  <p className="text-[11px] text-indigo-700 font-mono font-bold mt-0.5">
                    SN: {selectedItem.serialNumber || 'Bulk Unit'} · Avail Qty: {selectedItem.availableQuantity}
                  </p>
                </div>
                <button type="button" onClick={() => setSelectedItem(null)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Type product name or serial number..."
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-medium focus:outline-none focus:border-indigo-600"
                />
                {itemsData && itemsData.length > 0 && (
                  <div className="max-h-40 overflow-y-auto bg-white border border-slate-300 rounded-xl divide-y divide-slate-100 shadow-md">
                    {itemsData.map(item => (
                      <div
                        key={item.id}
                        onClick={() => { setSelectedItem(item); setForm(f => ({ ...f, inventoryItemId: item.id })); }}
                        className="p-2.5 hover:bg-indigo-50 cursor-pointer flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-900">{item.productName}</p>
                          <p className="text-[10px] text-slate-500 font-mono">SN: {item.serialNumber || 'Bulk'}</p>
                        </div>
                        <Badge variant="info">Avail: {item.availableQuantity}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">Destination BHEL Site *</label>
            <select
              required
              value={form.siteId}
              onChange={(e) => handleSelectSite(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
            >
              <option value="">Select Destination Site...</option>
              {(sitesData || []).map(s => (
                <option key={s.id} value={s.id}>{s.siteName} ({s.city}) - Class {s.locationClass}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Dispatch Date *</label>
              <input
                type="date"
                required
                value={form.dispatchDate}
                onChange={(e) => setForm(f => ({ ...f, dispatchDate: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Quantity *</label>
              <input
                type="number"
                min={1}
                required
                value={form.quantity}
                onChange={(e) => setForm(f => ({ ...f, quantity: parseInt(e.target.value, 10) }))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Courier Partner</label>
              <input
                type="text"
                placeholder="e.g. Blue Dart / DTDC"
                value={form.courierName}
                onChange={(e) => setForm(f => ({ ...f, courierName: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-medium focus:outline-none focus:border-indigo-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Tracking AWB No</label>
              <input
                type="text"
                placeholder="e.g. AWB-998877"
                value={form.trackingNo}
                onChange={(e) => setForm(f => ({ ...f, trackingNo: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-mono font-bold focus:outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button variant="ghost" size="sm" type="button" onClick={() => { setIsModalOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={createMutation.isPending}>
              Confirm Dispatch
            </Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
};
