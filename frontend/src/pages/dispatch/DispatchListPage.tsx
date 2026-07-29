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
  // If dispatchDate is midnight (from HTML date picker 00:00:00), use createdAt for live time
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

  const handleItemSelect = (item: InventoryItem) => {
    setSelectedItem(item);
    setForm(f => ({ ...f, inventoryItemId: item.id }));
    setItemSearch('');
  };

  const dispatches: any[] = data?.data || [];

  return (
    <Layout title="Dispatch Module">
      {/* Top Search & New Dispatch Action Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-5">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search Dispatch #, Site, Serial No, OEM..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>
        <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setIsModalOpen(true)}>
          New Dispatch
        </Button>
      </div>

      {/* Dispatches Main Table */}
      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm data-table border-collapse">
            <thead>
              <tr>
                <th className="p-3.5 w-32">Dispatch #</th>
                <th className="p-3.5">Spare Item &amp; OEM</th>
                <th className="p-3.5">Serial Number</th>
                <th className="p-3.5">BHEL Site &amp; Class</th>
                <th className="p-3.5">SPOC Contact</th>
                <th className="p-3.5 text-center w-16">Qty</th>
                <th className="p-3.5">Courier / AWB</th>
                <th className="p-3.5">Date &amp; Time</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right w-24">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {isLoading ? (
                <tr><td colSpan={10} className="p-10 text-center text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-500" />
                  Loading dispatches...
                </td></tr>
              ) : dispatches.length === 0 ? (
                <tr><td colSpan={10} className="p-10 text-center text-slate-500">
                  <Truck className="w-8 h-8 mx-auto mb-2 text-slate-700" />
                  No dispatch records found.
                </td></tr>
              ) : (
                dispatches.map((d) => {
                  const { date, time } = formatDateTime(d.dispatchDate, d.createdAt);

                  return (
                    <tr
                      key={d.id}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                      onClick={() => setDetailsDispatch(d)}
                    >
                      {/* Dispatch No */}
                      <td className="p-3.5 font-mono text-xs text-cyan-400 font-extrabold whitespace-nowrap">
                        {d.dispatchNo}
                      </td>

                      {/* Spare Item & OEM */}
                      <td className="p-3.5">
                        <p className="font-bold text-white text-xs">{d.inventoryItem?.productName || 'Spare Item'}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <Cpu className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{d.inventoryItem?.oem?.name || 'Standard OEM'}</span>
                        </p>
                      </td>

                      {/* Serial Number */}
                      <td className="p-3.5 font-mono text-xs whitespace-nowrap">
                        {d.inventoryItem?.serialNumber ? (
                          <span className="bg-brand-500/10 text-brand-400 px-2 py-0.5 rounded-md border border-brand-500/20 font-bold">
                            {d.inventoryItem?.serialNumber}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic text-[11px] bg-slate-900 px-2 py-0.5 rounded">
                            Bulk Item
                          </span>
                        )}
                      </td>

                      {/* BHEL Site & Location Class */}
                      <td className="p-3.5">
                        <p className="font-semibold text-slate-200 text-xs">{d.site?.siteName || 'Destination Site'}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {d.site?.city && (
                            <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 font-medium">
                              {d.site?.city}
                            </span>
                          )}
                          {d.site?.locationClass && (
                            <span className="text-[10px] bg-indigo-500/15 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/25 font-bold">
                              Class {d.site?.locationClass}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* SPOC Contact */}
                      <td className="p-3.5 text-xs">
                        <p className="font-semibold text-slate-200">{d.site?.contactPerson || 'Site SPOC'}</p>
                        {d.site?.phone && <p className="text-slate-400 font-mono text-[11px] mt-0.5">{d.site?.phone}</p>}
                      </td>

                      {/* Qty */}
                      <td className="p-3.5 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-800 text-white border border-slate-700">
                          {d.quantity}
                        </span>
                      </td>

                      {/* Courier / Tracking AWB */}
                      <td className="p-3.5 text-xs">
                        <p className="text-slate-200 font-semibold">{d.courierName || 'Courier Direct'}</p>
                        {d.trackingNo ? (
                          <p className="font-mono text-[11px] text-cyan-400 font-semibold">#{d.trackingNo}</p>
                        ) : (
                          <p className="text-[10px] text-slate-500 italic">No AWB logged</p>
                        )}
                      </td>

                      {/* Dispatch Date & Time (Stacked) */}
                      <td className="p-3.5 text-xs whitespace-nowrap">
                        <p className="font-bold text-slate-200 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-indigo-400 shrink-0" />
                          {date}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-amber-400 shrink-0" />
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
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-brand-600 text-slate-300 hover:text-white transition-colors"
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

      {/* Dispatch Full Details Modal */}
      <Modal
        isOpen={!!detailsDispatch}
        onClose={() => setDetailsDispatch(null)}
        title={`Dispatch Details — ${detailsDispatch?.dispatchNo}`}
        maxWidth="lg"
      >
        {detailsDispatch && (() => {
          const { date, time } = formatDateTime(detailsDispatch.dispatchDate, detailsDispatch.createdAt);

          return (
            <div className="space-y-4">
              {/* Top Header Banner */}
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-medium">Dispatch Reference</p>
                  <p className="text-lg font-mono font-extrabold text-cyan-400 mt-0.5">{detailsDispatch.dispatchNo}</p>
                </div>
                <Badge variant={statusVariant(detailsDispatch.status)} size="md">{detailsDispatch.status}</Badge>
              </div>

              {/* Date & Time Highlight Box */}
              <div className="p-3.5 bg-slate-950/80 border border-indigo-500/20 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="text-slate-400 font-medium">Dispatch Date:</span>
                  <span className="font-bold text-white">{date}</span>
                </div>
                <div className="flex items-center gap-2 border-l border-slate-800 pl-4">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-slate-400 font-medium">Time:</span>
                  <span className="font-mono font-bold text-amber-300">{time}</span>
                </div>
              </div>

              {/* Spare Part Details */}
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-brand-400" />
                  Dispatched Spare Item Details
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                  <div>
                    <p className="text-slate-500">Part Name</p>
                    <p className="font-semibold text-white">{detailsDispatch.inventoryItem?.productName}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">OEM</p>
                    <p className="font-semibold text-white">{detailsDispatch.inventoryItem?.oem?.name || 'Standard OEM'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Serial Number</p>
                    <p className="font-mono text-brand-400 font-bold">{detailsDispatch.inventoryItem?.serialNumber || 'Bulk / Non-Serial'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Quantity Dispatched</p>
                    <p className="font-extrabold text-white">{detailsDispatch.quantity} Pcs</p>
                  </div>
                </div>
              </div>

              {/* Destination Site & Location Class & SPOC Details */}
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                  Destination BHEL Site &amp; SPOC Info
                </p>
                <div className="space-y-2.5 text-xs text-slate-300">
                  <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <div>
                      <p className="font-bold text-white text-sm">{detailsDispatch.site?.siteName}</p>
                      {detailsDispatch.site?.unitDivision && (
                        <p className="text-[11px] text-slate-400 mt-0.5">Division: {detailsDispatch.site?.unitDivision}</p>
                      )}
                    </div>
                    {detailsDispatch.site?.locationClass && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        Class {detailsDispatch.site?.locationClass}
                      </span>
                    )}
                  </div>

                  {detailsDispatch.site?.fullAddress && (
                    <div className="flex items-start gap-2 pt-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                      <span className="text-slate-300">
                        {detailsDispatch.site?.fullAddress}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
                    {detailsDispatch.site?.contactPerson && (
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <div>
                          <p className="text-[10px] text-slate-500">Site SPOC</p>
                          <p className="font-semibold text-slate-200">{detailsDispatch.site.contactPerson}</p>
                        </div>
                      </div>
                    )}
                    {detailsDispatch.site?.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <div>
                          <p className="text-[10px] text-slate-500">Phone</p>
                          <p className="font-mono text-slate-300">{detailsDispatch.site.phone}</p>
                        </div>
                      </div>
                    )}
                    {detailsDispatch.site?.email && (
                      <div className="flex items-center gap-2 col-span-2">
                        <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <p className="text-slate-300">{detailsDispatch.site.email}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Shipping & Courier Details */}
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-cyan-400" />
                  Courier Shipping Details
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-slate-500">Courier Partner</p>
                    <p className="font-semibold text-white">{detailsDispatch.courierName || 'Direct Dispatch'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">AWB / Tracking Number</p>
                    <p className="font-mono text-cyan-300 font-bold">{detailsDispatch.trackingNo || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Dispatched By</p>
                    <p className="text-slate-300">{detailsDispatch.createdBy?.name || 'Administrator'}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-800">
                <Button variant="secondary" size="sm" onClick={() => setDetailsDispatch(null)}>
                  Close Details
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Create Dispatch Form Modal */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title="Create New Dispatch" maxWidth="xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Select Spare Part *</label>
              {selectedItem ? (
                <div className="p-3 rounded-xl bg-slate-900 border border-brand-500/30 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{selectedItem.productName}</p>
                    <p className="text-xs text-slate-400">SN: {selectedItem.serialNumber || selectedItem.spareId} · OEM: {selectedItem.oem?.name}</p>
                    <p className="text-xs text-emerald-400">Available Qty: {selectedItem.availableQuantity} {selectedItem.unit}</p>
                  </div>
                  <button onClick={() => { setSelectedItem(null); setForm(f => ({ ...f, inventoryItemId: '' })); }} className="text-slate-500 hover:text-rose-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    placeholder="Search spare by name, part code, serial..."
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                  />
                  {itemsData && itemsData.length > 0 && itemSearch && (
                    <div className="mt-1 bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
                      {itemsData.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleItemSelect(item)}
                          className="w-full text-left px-3 py-2.5 hover:bg-slate-800 transition-colors border-b border-slate-800 last:border-0"
                        >
                          <p className="text-sm font-medium text-white">{item.productName}</p>
                          <p className="text-xs text-slate-400">SN: {item.serialNumber || 'Bulk'} · {item.oem?.name} · Avail: {item.availableQuantity}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Destination BHEL Site *</label>
              <select
                value={form.siteId}
                onChange={(e) => {
                  const site = sitesData?.find(s => s.id === e.target.value);
                  setSelectedSite(site || null);
                  setForm(f => ({ ...f, siteId: e.target.value }));
                }}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
              >
                <option value="">— Select BHEL Site —</option>
                {sitesData?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.siteName} ({s.city}) {s.locationClass ? `[Class ${s.locationClass}]` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Dispatch Quantity *</label>
              <input
                type="number"
                min={1}
                max={selectedItem?.availableQuantity || 1}
                value={form.quantity}
                onChange={(e) => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="space-y-4">
            {selectedSite && (
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1 text-xs">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Selected Site Details</p>
                <p className="font-bold text-white text-sm">{selectedSite.siteName}</p>
                <p className="text-slate-400">Class: <span className="text-indigo-300 font-semibold">{selectedSite.locationClass || 'Standard'}</span> · SPOC: <span className="text-white">{selectedSite.contactPerson || 'N/A'}</span></p>
                <p className="text-slate-500">{selectedSite.fullAddress || `${selectedSite.city}, ${selectedSite.state}`}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Dispatch Date</label>
                <input
                  type="date"
                  value={form.dispatchDate}
                  onChange={(e) => setForm(f => ({ ...f, dispatchDate: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Courier Name</label>
                <input
                  type="text"
                  placeholder="e.g. DHL, BlueDart"
                  value={form.courierName}
                  onChange={(e) => setForm(f => ({ ...f, courierName: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tracking Number / AWB</label>
              <input
                type="text"
                placeholder="AWB / Tracking ID"
                value={form.trackingNo}
                onChange={(e) => setForm(f => ({ ...f, trackingNo: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Remarks / Instructions</label>
              <textarea
                rows={2}
                placeholder="Additional notes..."
                value={form.remarks}
                onChange={(e) => setForm(f => ({ ...f, remarks: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 resize-none"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-slate-800">
          <Button variant="secondary" onClick={() => { setIsModalOpen(false); resetForm(); }}>Cancel</Button>
          <Button
            variant="primary"
            icon={<Truck className="w-4 h-4" />}
            onClick={() => createMutation.mutate(form)}
            isLoading={createMutation.isPending}
            disabled={!form.inventoryItemId || !form.siteId}
          >
            Confirm Dispatch
          </Button>
        </div>
      </Modal>
    </Layout>
  );
};
