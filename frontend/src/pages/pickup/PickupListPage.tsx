import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  RotateCcw, Plus, Search, CheckCircle2, X, RefreshCw,
  PackageCheck, Building2, PackageOpen, Truck,
  Hash, Tag, Layers, MapPin, AlertTriangle, ArrowRight,
} from 'lucide-react';
import api from '../../api';
import { Layout } from '../../components/layout';
import { Button, Card, Badge, Modal } from '../../components/ui';
import { Pickup, Site, InventoryItem } from '../../types';

const statusVariant = (s: string): 'success' | 'danger' | 'warning' | 'info' | 'default' =>
  s === 'RECEIVED' ? 'success' : s === 'PENDING' ? 'warning' : s === 'IN_TRANSIT' ? 'info' : 'default';

type Tab = 'pickups' | 'oem-receipts';

interface OemReceiptForm {
  productName: string;
  partCode: string;
  oemId: string;
  categoryId: string;
  serialNumber: string;
  isSerialized: boolean;
  store: 'Delhi' | 'Bengaluru';
  rack: string;
  bin: string;
  quantity: number;
  unit: string;
  remarks: string;
  linkedPickupId: string;
}

const defaultOemForm = (): OemReceiptForm => ({
  productName: '',
  partCode: '',
  oemId: '',
  categoryId: '',
  serialNumber: '',
  isSerialized: true,
  store: 'Delhi',
  rack: '',
  bin: '',
  quantity: 1,
  unit: 'Pcs',
  remarks: '',
  linkedPickupId: '',
});

export const PickupListPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>('pickups');
  const [search, setSearch] = useState('');
  const [oemSearch, setOemSearch] = useState('');

  // Site pickup modal
  const [isPickupModalOpen, setIsPickupModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [itemSearch, setItemSearch] = useState('');
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

  // OEM receipt modal
  const [isOemModalOpen, setIsOemModalOpen] = useState(false);
  const [oemForm, setOemForm] = useState<OemReceiptForm>(defaultOemForm());
  const [oemSuccess, setOemSuccess] = useState<any>(null);

  // Deep link: pre-fill pickup if coming from inventory page
  const preItemId = searchParams.get('itemId');
  useEffect(() => {
    if (preItemId) {
      api.get(`/inventory/${preItemId}`).then((res) => {
        setSelectedItem(res.data.data);
        setPickupForm(f => ({ ...f, inventoryItemId: preItemId }));
        setIsPickupModalOpen(true);
      });
    }
  }, [preItemId]);

  // Data fetching
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
    enabled: activeTab === 'oem-receipts',
  });

  const { data: sitesData } = useQuery({
    queryKey: ['sites-dropdown'],
    queryFn: async () => {
      const res = await api.get('/sites/dropdown');
      return res.data.data as Site[];
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

  const { data: oemsData } = useQuery({
    queryKey: ['oems-list'],
    queryFn: async () => {
      const res = await api.get('/inventory/oems');
      return res.data.data;
    },
    enabled: isOemModalOpen,
  });

  const { data: catsData } = useQuery({
    queryKey: ['categories-list'],
    queryFn: async () => {
      const res = await api.get('/inventory/categories');
      return res.data.data;
    },
    enabled: isOemModalOpen,
  });

  const { data: pickupListForLink } = useQuery({
    queryKey: ['pickups-open'],
    queryFn: async () => {
      const res = await api.get('/pickup', { params: { status: 'PICKED_UP', limit: 50 } });
      return res.data.data as Pickup[];
    },
    enabled: isOemModalOpen,
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
      <div className="flex gap-1 mb-5 p-1 bg-slate-900/80 border border-slate-800 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('pickups')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'pickups'
              ? 'bg-brand-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          Site Pickups
        </button>
        <button
          onClick={() => setActiveTab('oem-receipts')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'oem-receipts'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <PackageOpen className="w-3.5 h-3.5" />
          OEM Receipts
          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-500/30">+Inventory</span>
        </button>
      </div>

      {/* ============================== SITE PICKUPS TAB ============================== */}
      {activeTab === 'pickups' && (
        <>
          <div className="flex items-center justify-between mb-5">
            <div className="relative w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search pickups..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>
            <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setIsPickupModalOpen(true)}>
              New Pickup
            </Button>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/80 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
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
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {pickupsLoading ? (
                    <tr><td colSpan={10} className="p-8 text-center text-slate-500">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-500" />
                      Loading pickups...
                    </td></tr>
                  ) : pickups.length === 0 ? (
                    <tr><td colSpan={10} className="p-8 text-center text-slate-500">
                      <RotateCcw className="w-8 h-8 mx-auto mb-2 text-slate-700" />
                      No pickup records found.
                    </td></tr>
                  ) : (
                    pickups.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3.5 font-mono text-xs text-emerald-400 font-semibold whitespace-nowrap">{p.pickupNo}</td>
                        <td className="p-3.5">
                          <p className="font-semibold text-slate-100">{p.inventoryItem?.productName}</p>
                          <p className="text-xs text-slate-500 font-mono">{p.inventoryItem?.spareId}</p>
                        </td>
                        <td className="p-3.5">
                          <p className="font-semibold text-slate-200 text-xs">{p.site?.siteName}</p>
                          <p className="text-xs text-slate-500">{p.site?.city}</p>
                        </td>
                        <td className="p-3.5 text-xs text-slate-400">{p.site?.contactPerson || '—'}</td>
                        <td className="p-3.5 font-bold text-white">{p.quantity}</td>
                        <td className="p-3.5 text-xs">
                          <p className="text-slate-300">{p.courierName || '—'}</p>
                          {p.trackingNo && <p className="font-mono text-slate-500">#{p.trackingNo}</p>}
                        </td>
                        <td className="p-3.5 text-xs text-amber-400 italic max-w-40 truncate">{p.faultDescription || '—'}</td>
                        <td className="p-3.5 text-xs text-slate-400 whitespace-nowrap">
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
                            <span className="text-xs text-emerald-400 flex items-center gap-1 justify-end">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Received
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
          <div className="mb-4 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3">
            <PackageOpen className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emerald-300">OEM Replacement Receipt</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Jab OEM se replacement part aata hai — yahan add karo. System automatically inventory mein new entry <strong className="text-emerald-400">AVAILABLE</strong> status ke saath create karega.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between mb-5">
            <div className="relative w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search OEM receipts..."
                value={oemSearch}
                onChange={(e) => setOemSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
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

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/80 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
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
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {oemLoading ? (
                    <tr><td colSpan={9} className="p-8 text-center text-slate-500">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />
                      Loading OEM receipts...
                    </td></tr>
                  ) : oemReceipts.length === 0 ? (
                    <tr><td colSpan={9} className="p-8 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-500">
                        <PackageOpen className="w-10 h-10 text-slate-700" />
                        <p className="text-sm">No OEM receipts yet.</p>
                        <p className="text-xs text-slate-600">Click "Add OEM Receipt" to log a new incoming replacement part.</p>
                      </div>
                    </td></tr>
                  ) : (
                    oemReceipts.map((item: any) => (
                      <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3.5 font-mono text-xs text-emerald-400 font-semibold">{item.spareId}</td>
                        <td className="p-3.5 font-semibold text-slate-100">{item.productName}</td>
                        <td className="p-3.5 text-slate-300 text-xs">{item.oem?.name || '—'}</td>
                        <td className="p-3.5 font-mono text-xs text-slate-400">{item.partCode || '—'}</td>
                        <td className="p-3.5">
                          {item.serialNumber ? (
                            <span className="bg-brand-500/10 text-brand-400 px-2 py-0.5 rounded border border-brand-500/20 font-mono text-xs font-bold">
                              {item.serialNumber}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-xs italic">—</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.store === 'Delhi' ? 'bg-blue-500/15 text-blue-400' : 'bg-orange-500/15 text-orange-400'}`}>
                            {item.store}
                          </span>
                        </td>
                        <td className="p-3.5 text-xs text-slate-400 whitespace-nowrap">
                          {new Date(item.createdAt).toLocaleDateString('en-IN')}
                        </td>
                        <td className="p-3.5">
                          <Badge variant="success">AVAILABLE</Badge>
                        </td>
                        <td className="p-3.5 text-xs text-slate-400">{item.createdBy?.name || '—'}</td>
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
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Select Spare Part *</label>
              {selectedItem ? (
                <div className="p-3 rounded-xl bg-slate-900 border border-brand-500/30 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{selectedItem.productName}</p>
                    <p className="text-xs text-slate-400">{selectedItem.spareId} · {selectedItem.oem?.name}</p>
                  </div>
                  <button onClick={() => { setSelectedItem(null); setPickupForm(f => ({ ...f, inventoryItemId: '' })); }}>
                    <X className="w-4 h-4 text-slate-400 hover:text-rose-400" />
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    placeholder="Search spare part..."
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                  />
                  {itemsData && itemsData.length > 0 && itemSearch && (
                    <div className="mt-1 bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                      {itemsData.map((item) => (
                        <button key={item.id} onClick={() => { setSelectedItem(item); setPickupForm(f => ({ ...f, inventoryItemId: item.id })); setItemSearch(''); }}
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
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">BHEL Site *</label>
              <select
                value={pickupForm.siteId}
                onChange={(e) => {
                  const site = sitesData?.find(s => s.id === e.target.value);
                  setSelectedSite(site || null);
                  setPickupForm(f => ({ ...f, siteId: e.target.value }));
                }}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
              >
                <option value="">— Select BHEL Site —</option>
                {sitesData?.map((s) => (
                  <option key={s.id} value={s.id}>{s.siteName} ({s.city})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Quantity *</label>
              <input type="number" min={1} value={pickupForm.quantity}
                onChange={(e) => setPickupForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Fault Description</label>
              <textarea rows={3} placeholder="Describe the fault or reason for pickup..."
                value={pickupForm.faultDescription}
                onChange={(e) => setPickupForm(f => ({ ...f, faultDescription: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 resize-none"
              />
            </div>
          </div>

          <div className="space-y-4">
            {selectedSite && (
              <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 space-y-1.5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Site Details</p>
                <p className="text-sm font-semibold text-white">{selectedSite.siteName}</p>
                <p className="text-xs text-slate-400">{selectedSite.contactPerson} · {selectedSite.phone}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Pickup Date</label>
                <input type="date" value={pickupForm.pickupDate}
                  onChange={(e) => setPickupForm(f => ({ ...f, pickupDate: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Courier</label>
                <input type="text" placeholder="e.g. DHL" value={pickupForm.courierName}
                  onChange={(e) => setPickupForm(f => ({ ...f, courierName: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tracking Number</label>
              <input type="text" placeholder="AWB / Tracking ID" value={pickupForm.trackingNo}
                onChange={(e) => setPickupForm(f => ({ ...f, trackingNo: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Remarks</label>
              <textarea rows={2} placeholder="Additional notes..." value={pickupForm.remarks}
                onChange={(e) => setPickupForm(f => ({ ...f, remarks: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 resize-none" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-slate-800">
          <Button variant="secondary" onClick={() => { setIsPickupModalOpen(false); resetPickupForm(); }}>Cancel</Button>
          <Button variant="primary" icon={<RotateCcw className="w-4 h-4" />} onClick={() => createPickupMutation.mutate(pickupForm)}
            isLoading={createPickupMutation.isPending} disabled={!pickupForm.inventoryItemId || !pickupForm.siteId}>
            Create Pickup
          </Button>
        </div>
      </Modal>

      {/* ============================== OEM RECEIPT MODAL ============================== */}
      <Modal
        isOpen={isOemModalOpen}
        onClose={() => { setIsOemModalOpen(false); setOemSuccess(null); }}
        title="Add OEM Replacement Receipt"
        maxWidth="xl"
      >
        {oemSuccess ? (
          // Success state
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-white">Part Added to Inventory!</p>
              <p className="text-sm text-slate-400 mt-1">The OEM replacement part is now available in inventory.</p>
            </div>

            <div className="p-4 bg-slate-900 border border-emerald-500/20 rounded-xl text-left space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <Hash className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-400">Spare ID:</span>
                <span className="font-mono font-bold text-emerald-400">{oemSuccess.spareId}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Tag className="w-3.5 h-3.5 text-brand-400" />
                <span className="text-slate-400">Part:</span>
                <span className="font-semibold text-white">{oemSuccess.productName}</span>
              </div>
              {oemSuccess.serialNumber && (
                <div className="flex items-center gap-2 text-xs">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-400">Serial No.:</span>
                  <span className="font-mono text-brand-300 font-bold">{oemSuccess.serialNumber}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400">Store:</span>
                <span className="text-white">{oemSuccess.store} Store</span>
                {oemSuccess.rack && <span className="text-slate-400">· Rack {oemSuccess.rack}</span>}
                {oemSuccess.bin && <span className="text-slate-400">· Bin {oemSuccess.bin}</span>}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-800 flex items-center gap-2">
                <Badge variant="success">AVAILABLE</Badge>
                <span className="text-xs text-emerald-400 font-semibold">Ready to use in inventory</span>
              </div>
            </div>

            <div className="flex gap-2 justify-center">
              <Button variant="secondary" size="sm" onClick={() => { setOemSuccess(null); setOemForm(defaultOemForm()); }}>
                Add Another Part
              </Button>
              <Button variant="primary" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />} onClick={() => setIsOemModalOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          // Form
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Left column */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Part Name / Description *</label>
                  <input
                    type="text"
                    placeholder="e.g. IGBT Module, Power Supply Board..."
                    value={oemForm.productName}
                    onChange={(e) => setOemForm(f => ({ ...f, productName: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Part Code</label>
                  <input
                    type="text"
                    placeholder="e.g. IGBT-600V-3300A"
                    value={oemForm.partCode}
                    onChange={(e) => setOemForm(f => ({ ...f, partCode: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">OEM</label>
                  <select
                    value={oemForm.oemId}
                    onChange={(e) => setOemForm(f => ({ ...f, oemId: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="">— Select OEM —</option>
                    {(oemsData || []).map((oem: any) => (
                      <option key={oem.id} value={oem.id}>{oem.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Category</label>
                  <select
                    value={oemForm.categoryId}
                    onChange={(e) => setOemForm(f => ({ ...f, categoryId: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="">— Select Category —</option>
                    {(catsData || []).map((cat: any) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* Link to open pickup */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Link to Existing Pickup <span className="text-slate-500 font-normal">(optional)</span>
                  </label>
                  <select
                    value={oemForm.linkedPickupId}
                    onChange={(e) => setOemForm(f => ({ ...f, linkedPickupId: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="">— None —</option>
                    {(pickupListForLink || []).map((pu: Pickup) => (
                      <option key={pu.id} value={pu.id}>
                        {pu.pickupNo} — {pu.inventoryItem?.productName}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">If selected, the linked pickup will be marked as RECEIVED automatically.</p>
                </div>
              </div>

              {/* Right column */}
              <div className="space-y-4">
                {/* Serialized toggle */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Part Type</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setOemForm(f => ({ ...f, isSerialized: true }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${oemForm.isSerialized ? 'bg-brand-600 border-brand-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                    >
                      Serialized (has S/N)
                    </button>
                    <button
                      onClick={() => setOemForm(f => ({ ...f, isSerialized: false, serialNumber: '' }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${!oemForm.isSerialized ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                    >
                      Non-Serialized (bulk)
                    </button>
                  </div>
                </div>

                {oemForm.isSerialized && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">New Serial Number *</label>
                    <input
                      type="text"
                      placeholder="Enter the serial number of this unit..."
                      value={oemForm.serialNumber}
                      onChange={(e) => setOemForm(f => ({ ...f, serialNumber: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-slate-900 border border-brand-500/40 rounded-xl text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                )}

                {!oemForm.isSerialized && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Quantity *</label>
                    <input
                      type="number"
                      min={1}
                      value={oemForm.quantity}
                      onChange={(e) => setOemForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>
                )}

                {/* Store */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Store *</label>
                  <div className="flex gap-2">
                    {(['Delhi', 'Bengaluru'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setOemForm(f => ({ ...f, store: s }))}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${oemForm.store === s ? 'bg-brand-600 border-brand-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                      >
                        {s} Store
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rack & Bin */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Rack</label>
                    <input
                      type="text"
                      placeholder="e.g. A1"
                      value={oemForm.rack}
                      onChange={(e) => setOemForm(f => ({ ...f, rack: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Bin</label>
                    <input
                      type="text"
                      placeholder="e.g. B3"
                      value={oemForm.bin}
                      onChange={(e) => setOemForm(f => ({ ...f, bin: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Remarks / Notes</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Received from Siemens India, PO #12345..."
                    value={oemForm.remarks}
                    onChange={(e) => setOemForm(f => ({ ...f, remarks: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 resize-none"
                  />
                </div>
              </div>
            </div>

            {oemReceiptMutation.isError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <p className="text-sm text-rose-400">Failed to add OEM receipt. Please try again.</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <Button variant="secondary" onClick={() => { setIsOemModalOpen(false); setOemSuccess(null); }}>Cancel</Button>
              <Button
                variant="primary"
                icon={<PackageOpen className="w-4 h-4" />}
                onClick={() => oemReceiptMutation.mutate(oemForm)}
                isLoading={oemReceiptMutation.isPending}
                disabled={!oemForm.productName || (oemForm.isSerialized && !oemForm.serialNumber)}
              >
                Add to Inventory as AVAILABLE
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  );
};
