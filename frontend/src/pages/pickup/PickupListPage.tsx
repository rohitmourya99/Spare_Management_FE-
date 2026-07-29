import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  RotateCcw, Plus, Search, CheckCircle2, X, RefreshCw,
  Building2, MapPin, User, Phone, Mail, Eye, Tag, Cpu, Clock, Calendar,
  PackageOpen, Truck, PackageCheck, AlertCircle
} from 'lucide-react';
import api from '../../api';
import { Layout } from '../../components/layout';
import { Button, Card, Badge, Modal } from '../../components/ui';
import { Site, InventoryItem, OEM } from '../../types';

interface Pickup {
  id: string;
  pickupNo: string;
  inventoryItemId: string;
  inventoryItem?: InventoryItem;
  siteId: string;
  site?: Site;
  quantity: number;
  faultDescription?: string;
  courierName?: string;
  trackingNo?: string;
  pickupDate?: string;
  status: string;
  receivedConfirmed?: boolean;
  receivedAt?: string;
  createdAt: string;
}

interface OemReceiptForm {
  productName: string;
  oemId: string;
  partCode: string;
  serialNumber: string;
  store: 'Delhi' | 'Bengaluru';
  remarks?: string;
}

const defaultOemForm = (): OemReceiptForm => ({
  productName: '',
  oemId: '',
  partCode: '',
  serialNumber: '',
  store: 'Delhi',
  remarks: '',
});

const statusVariant = (s: string): 'success' | 'danger' | 'warning' | 'info' | 'default' =>
  s === 'RECEIVED' ? 'success' : s === 'IN_TRANSIT' ? 'warning' : s === 'CANCELLED' ? 'danger' : 'info';

export const PickupListPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'pickups' | 'oem-receipts'>('pickups');
  const [search, setSearch] = useState('');
  const [oemSearch, setOemSearch] = useState('');

  // Modals
  const [isPickupModalOpen, setIsPickupModalOpen] = useState(false);
  const [isOemModalOpen, setIsOemModalOpen] = useState(false);

  // Selection & Search
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [itemSearch, setItemSearch] = useState('');

  // Pickup Form
  const [pickupForm, setPickupForm] = useState({
    inventoryItemId: '',
    siteId: '',
    quantity: 1,
    faultDescription: '',
    courierName: '',
    trackingNo: '',
    pickupDate: new Date().toISOString().split('T')[0],
    remarks: '',
  });

  // OEM Receipt Form
  const [oemForm, setOemForm] = useState<OemReceiptForm>(defaultOemForm());
  const [oemSuccess, setOemSuccess] = useState<any | null>(null);

  // Queries
  const { data: pickupsData, isLoading: pickupsLoading } = useQuery({
    queryKey: ['pickups', search],
    queryFn: async () => {
      const res = await api.get('/pickup', { params: { search } });
      return res.data;
    },
  });

  const { data: oemReceiptsData, isLoading: oemLoading } = useQuery({
    queryKey: ['oem-receipts', oemSearch],
    queryFn: async () => {
      const res = await api.get('/pickup/oem-receipts', { params: { search: oemSearch } });
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

  const { data: oemsData } = useQuery({
    queryKey: ['oems-list'],
    queryFn: async () => {
      const res = await api.get('/inventory/oems');
      return res.data.data as OEM[];
    },
  });

  const { data: itemsData } = useQuery({
    queryKey: ['inventory-search-pickup', itemSearch],
    queryFn: async () => {
      const res = await api.get('/inventory', { params: { search: itemSearch, limit: 10 } });
      return res.data.data as InventoryItem[];
    },
    enabled: isPickupModalOpen && itemSearch.length > 0,
  });

  // Mutations
  const createPickupMutation = useMutation({
    mutationFn: async (payload: typeof pickupForm) => {
      const res = await api.post('/pickup', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pickups'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setIsPickupModalOpen(false);
      resetPickupForm();
    },
  });

  const confirmReceiptMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/pickup/${id}/confirm-receipt`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pickups'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });

  const oemReceiptMutation = useMutation({
    mutationFn: async (payload: OemReceiptForm) => {
      const res = await api.post('/pickup/oem-receipt', payload);
      return res.data.data;
    },
    onSuccess: (data) => {
      setOemSuccess(data);
      queryClient.invalidateQueries({ queryKey: ['oem-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });

  const resetPickupForm = () => {
    setPickupForm({ inventoryItemId: '', siteId: '', quantity: 1, faultDescription: '', courierName: '', trackingNo: '', pickupDate: new Date().toISOString().split('T')[0], remarks: '' });
    setSelectedItem(null);
    setSelectedSite(null);
    setItemSearch('');
  };

  const pickups: Pickup[] = pickupsData?.data || [];
  const oemReceipts = oemReceiptsData?.data || [];

  return (
    <Layout title="Pickup & OEM Receipts">
      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 bg-slate-100 border border-slate-200 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('pickups')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'pickups'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          Site Pickups
        </button>
        <button
          onClick={() => setActiveTab('oem-receipts')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'oem-receipts'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <PackageOpen className="w-3.5 h-3.5" />
          OEM Receipts
          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full border border-emerald-200 font-bold">+Inventory</span>
        </button>
      </div>

      {/* ============================== SITE PICKUPS TAB ============================== */}
      {activeTab === 'pickups' && (
        <>
          <div className="flex items-center justify-between gap-4 mb-5">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                placeholder="Search site pickups..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 font-medium"
              />
            </div>
            <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setIsPickupModalOpen(true)}>
              New Pickup
            </Button>
          </div>

          <Card noPadding>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm data-table">
                <thead>
                  <tr>
                    <th className="p-3.5">Pickup No</th>
                    <th className="p-3.5">Spare Item</th>
                    <th className="p-3.5">BHEL Site</th>
                    <th className="p-3.5">Contact</th>
                    <th className="p-3.5">Qty</th>
                    <th className="p-3.5">Courier / Tracking</th>
                    <th className="p-3.5">Fault Description</th>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-900">
                  {pickupsLoading ? (
                    <tr><td colSpan={10} className="p-8 text-center text-slate-500 font-semibold">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                      Loading pickups...
                    </td></tr>
                  ) : pickups.length === 0 ? (
                    <tr><td colSpan={10} className="p-8 text-center text-slate-500 font-semibold">
                      <RotateCcw className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                      No pickup records found.
                    </td></tr>
                  ) : (
                    pickups.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3.5 font-mono text-xs text-emerald-700 font-black whitespace-nowrap">{p.pickupNo}</td>
                        <td className="p-3.5">
                          <p className="font-bold text-slate-900">{p.inventoryItem?.productName}</p>
                          <p className="text-xs text-indigo-600 font-mono font-bold">{p.inventoryItem?.spareId}</p>
                        </td>
                        <td className="p-3.5">
                          <p className="font-bold text-slate-900 text-xs">{p.site?.siteName}</p>
                          <p className="text-xs text-slate-500 font-medium">{p.site?.city}</p>
                        </td>
                        <td className="p-3.5 text-xs text-slate-700 font-semibold">{p.site?.contactPerson || '—'}</td>
                        <td className="p-3.5 font-black text-slate-900">{p.quantity}</td>
                        <td className="p-3.5 text-xs">
                          <p className="text-slate-900 font-bold">{p.courierName || '—'}</p>
                          {p.trackingNo && <p className="font-mono text-indigo-600 font-bold">#{p.trackingNo}</p>}
                        </td>
                        <td className="p-3.5 text-xs text-amber-700 font-bold italic max-w-40 truncate">{p.faultDescription || '—'}</td>
                        <td className="p-3.5 text-xs text-slate-700 font-semibold whitespace-nowrap">
                          {p.pickupDate ? new Date(p.pickupDate).toLocaleDateString('en-IN') : '—'}
                        </td>
                        <td className="p-3.5">
                          <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                        </td>
                        <td className="p-3.5 text-right">
                          {p.status === 'IN_TRANSIT' && !p.receivedConfirmed && (
                            <Button
                              size="sm"
                              variant="primary"
                              icon={<PackageCheck className="w-3.5 h-3.5" />}
                              onClick={() => confirmReceiptMutation.mutate(p.id)}
                              isLoading={confirmReceiptMutation.isPending}
                            >
                              Confirm Receipt
                            </Button>
                          )}
                          {p.receivedConfirmed && (
                            <span className="text-xs text-emerald-700 font-extrabold flex items-center gap-1 justify-end">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Received
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ============================== OEM RECEIPTS TAB ============================== */}
      {activeTab === 'oem-receipts' && (
        <>
          {/* Info Banner */}
          <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 shadow-sm">
            <PackageOpen className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-emerald-900">OEM Replacement Receipt</p>
              <p className="text-xs text-emerald-700 mt-0.5 font-medium">
                Log replacement parts directly received from OEM vendor. System automatically creates a new inventory record marked <strong className="text-emerald-900 font-black">AVAILABLE</strong> in the designated store.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 mb-5">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                placeholder="Search OEM receipts..."
                value={oemSearch}
                onChange={(e) => setOemSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 font-medium"
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => { setOemSuccess(null); setOemForm(defaultOemForm()); setIsOemModalOpen(true); }}
            >
              Add OEM Receipt
            </Button>
          </div>

          <Card noPadding>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm data-table">
                <thead>
                  <tr>
                    <th className="p-3.5">Spare ID</th>
                    <th className="p-3.5">Part Name</th>
                    <th className="p-3.5">OEM</th>
                    <th className="p-3.5">Part Code</th>
                    <th className="p-3.5">Serial No.</th>
                    <th className="p-3.5">Store</th>
                    <th className="p-3.5">Received On</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Added By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-900">
                  {oemLoading ? (
                    <tr><td colSpan={9} className="p-8 text-center text-slate-500 font-semibold">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-600" />
                      Loading OEM receipts...
                    </td></tr>
                  ) : oemReceipts.length === 0 ? (
                    <tr><td colSpan={9} className="p-8 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-500 font-semibold">
                        <PackageOpen className="w-10 h-10 text-slate-400" />
                        <p className="text-sm">No OEM receipts yet.</p>
                        <p className="text-xs text-slate-500">Click "Add OEM Receipt" to log a new incoming replacement part.</p>
                      </div>
                    </td></tr>
                  ) : (
                    oemReceipts.map((item: any) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3.5 font-mono text-xs text-emerald-700 font-black">{item.spareId}</td>
                        <td className="p-3.5 font-bold text-slate-900">{item.productName}</td>
                        <td className="p-3.5 text-slate-800 text-xs font-semibold">{item.oem?.name || '—'}</td>
                        <td className="p-3.5 font-mono text-xs text-slate-700 font-semibold">{item.partCode || '—'}</td>
                        <td className="p-3.5">
                          {item.serialNumber ? (
                            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 font-mono text-xs font-bold">
                              {item.serialNumber}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-xs italic font-medium">—</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.store === 'Delhi' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-orange-50 text-orange-700 border border-orange-200'}`}>
                            {item.store}
                          </span>
                        </td>
                        <td className="p-3.5 text-xs text-slate-700 font-semibold whitespace-nowrap">
                          {new Date(item.createdAt).toLocaleDateString('en-IN')}
                        </td>
                        <td className="p-3.5">
                          <Badge variant="success">AVAILABLE</Badge>
                        </td>
                        <td className="p-3.5 text-xs text-slate-700 font-semibold">{item.createdBy?.name || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ============================== PICKUP FORM MODAL ============================== */}
      <Modal isOpen={isPickupModalOpen} onClose={() => { setIsPickupModalOpen(false); resetPickupForm(); }} title="Create Pickup Request" maxWidth="xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Select Spare Part *</label>
              {selectedItem ? (
                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-indigo-950">{selectedItem.productName}</p>
                    <p className="text-xs text-indigo-700 font-mono font-bold">{selectedItem.spareId} · {selectedItem.oem?.name}</p>
                  </div>
                  <button onClick={() => { setSelectedItem(null); setPickupForm(f => ({ ...f, inventoryItemId: '' })); }}>
                    <X className="w-4 h-4 text-slate-400 hover:text-rose-600" />
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    placeholder="Search spare part..."
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-medium focus:outline-none focus:border-indigo-600"
                  />
                  {itemsData && itemsData.length > 0 && itemSearch && (
                    <div className="mt-1 bg-white border border-slate-300 rounded-xl overflow-hidden shadow-md divide-y divide-slate-100">
                      {itemsData.map((item) => (
                        <button key={item.id} onClick={() => { setSelectedItem(item); setPickupForm(f => ({ ...f, inventoryItemId: item.id })); setItemSearch(''); }}
                          className="w-full text-left px-3 py-2.5 hover:bg-indigo-50">
                          <p className="text-sm font-bold text-slate-900">{item.productName}</p>
                          <p className="text-xs text-slate-500 font-mono font-semibold">{item.oem?.name} · {item.spareId}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">BHEL Site *</label>
              <select
                value={pickupForm.siteId}
                onChange={(e) => {
                  const site = sitesData?.find(s => s.id === e.target.value);
                  setSelectedSite(site || null);
                  setPickupForm(f => ({ ...f, siteId: e.target.value }));
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
              >
                <option value="">— Select BHEL Site —</option>
                {sitesData?.map((s) => (
                  <option key={s.id} value={s.id}>{s.siteName} ({s.city})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Quantity *</label>
              <input type="number" min={1} value={pickupForm.quantity}
                onChange={(e) => setPickupForm(f => ({ ...f, quantity: parseInt(e.target.value, 10) || 1 }))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-bold focus:outline-none focus:border-indigo-600" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Pickup Date *</label>
              <input type="date" value={pickupForm.pickupDate}
                onChange={(e) => setPickupForm(f => ({ ...f, pickupDate: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-bold focus:outline-none focus:border-indigo-600" />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Fault Description</label>
              <textarea rows={3} placeholder="Describe reason for pickup..."
                value={pickupForm.faultDescription}
                onChange={(e) => setPickupForm(f => ({ ...f, faultDescription: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-medium focus:outline-none focus:border-indigo-600" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Courier Partner</label>
              <input type="text" placeholder="e.g. Blue Dart"
                value={pickupForm.courierName}
                onChange={(e) => setPickupForm(f => ({ ...f, courierName: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-medium focus:outline-none focus:border-indigo-600" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Tracking / AWB No.</label>
              <input type="text" placeholder="e.g. AWB998877"
                value={pickupForm.trackingNo}
                onChange={(e) => setPickupForm(f => ({ ...f, trackingNo: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-mono font-bold focus:outline-none focus:border-indigo-600" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 mt-4">
          <Button variant="ghost" size="sm" onClick={() => { setIsPickupModalOpen(false); resetPickupForm(); }}>Cancel</Button>
          <Button variant="primary" size="sm" isLoading={createPickupMutation.isPending} onClick={() => createPickupMutation.mutate(pickupForm)}>
            Create Pickup
          </Button>
        </div>
      </Modal>

      {/* ============================== OEM RECEIPT MODAL ============================== */}
      <Modal isOpen={isOemModalOpen} onClose={() => setIsOemModalOpen(false)} title="Log OEM Replacement Receipt" maxWidth="md">
        <form onSubmit={(e) => { e.preventDefault(); oemReceiptMutation.mutate(oemForm); }} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">Product / Part Name *</label>
            <input type="text" required placeholder="e.g. Cisco Nexus Switch Module"
              value={oemForm.productName} onChange={(e) => setOemForm(f => ({ ...f, productName: e.target.value }))}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-bold focus:outline-none focus:border-indigo-600" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">OEM Vendor *</label>
              <select required value={oemForm.oemId} onChange={(e) => setOemForm(f => ({ ...f, oemId: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-bold focus:outline-none focus:border-indigo-600">
                <option value="">— Select OEM —</option>
                {oemsData?.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Target Store *</label>
              <select value={oemForm.store} onChange={(e) => setOemForm(f => ({ ...f, store: e.target.value as any }))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-bold focus:outline-none focus:border-indigo-600">
                <option value="Delhi">Delhi Store</option>
                <option value="Bengaluru">Bengaluru Store</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Part Code</label>
              <input type="text" placeholder="e.g. N9K-C93108TC-EX"
                value={oemForm.partCode} onChange={(e) => setOemForm(f => ({ ...f, partCode: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-mono font-bold focus:outline-none focus:border-indigo-600" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Serial Number</label>
              <input type="text" placeholder="e.g. FOC2411L0AB"
                value={oemForm.serialNumber} onChange={(e) => setOemForm(f => ({ ...f, serialNumber: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-mono font-bold focus:outline-none focus:border-indigo-600" />
            </div>
          </div>

          {oemSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center justify-between">
              <span>Receipt logged! Spare ID: <strong>{oemSuccess.spareId}</strong></span>
              <Badge variant="success">AVAILABLE</Badge>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsOemModalOpen(false)}>Close</Button>
            <Button variant="success" size="sm" type="submit" isLoading={oemReceiptMutation.isPending}>Add Receipt to Inventory</Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
};
