import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Plus, Download, Upload, QrCode, Eye,
  ChevronLeft, ChevronRight, X, AlertTriangle, CheckCircle2,
  Package, RefreshCw, FileUp, Building2, MapPin, User, Phone, Mail,
  Truck, Check, Clock, Tag, Cpu,
} from 'lucide-react';
import api from '../../api';
import { Layout } from '../../components/layout';
import { Button, Card, Badge, Modal } from '../../components/ui';
import { InventoryItem } from '../../types';

const statusVariant = (s: string): 'success' | 'danger' | 'warning' | 'default' =>
  s === 'AVAILABLE' ? 'success' : s === 'DISPATCHED' ? 'danger' : 'warning';

export const InventoryListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [store, setStore] = useState<'All' | 'Delhi' | 'Bengaluru'>('All');
  const [filterSerialized, setFilterSerialized] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);

  // Modals
  const [qrModalItem, setQrModalItem] = useState<InventoryItem | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importStore, setImportStore] = useState<'Delhi' | 'Bengaluru'>('Delhi');
  const [importSummary, setImportSummary] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Location / Reserved Info Modal State
  const [locationModalItem, setLocationModalItem] = useState<InventoryItem | null>(null);
  const [locationDetails, setLocationDetails] = useState<any>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);

  // Add Replacement Serial Modal State
  const [replacementModalItem, setReplacementModalItem] = useState<InventoryItem | null>(null);
  const [replacementSerial, setReplacementSerial] = useState('');

  // Handle deep link ?action=import from Dashboard Quick Action
  useEffect(() => {
    if (searchParams.get('action') === 'import') {
      setImportSummary(null);
      setImportModalOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  const params: any = { search, page, limit: 15 };
  if (store !== 'All') params.store = store;
  if (filterSerialized) params.isSerialized = filterSerialized;
  if (filterStatus) params.status = filterStatus;

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', params],
    queryFn: async () => {
      const res = await api.get('/inventory', { params });
      return res.data;
    },
  });

  const items: InventoryItem[] = data?.data || [];
  const pagination = data?.pagination;

  // Mutation for Manual Status Override (AVAILABLE <-> RESERVED <-> DISPATCHED)
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await api.put(`/inventory/${id}`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });

  // Mutation for Adding Replacement Serial Part
  const createReplacementMutation = useMutation({
    mutationFn: async (baseItem: InventoryItem) => {
      const payload = {
        productName: baseItem.productName,
        oemId: baseItem.oemId,
        categoryId: baseItem.categoryId,
        partCode: baseItem.partCode,
        serialNumber: replacementSerial.trim(),
        isSerialized: true,
        quantity: 1,
        availableQuantity: 1,
        store: baseItem.store,
        rack: baseItem.rack,
        bin: baseItem.bin,
        status: 'AVAILABLE',
        remarks: `Replacement unit for dispatched item ${baseItem.serialNumber || baseItem.spareId}`,
      };
      const res = await api.post('/inventory', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setReplacementModalItem(null);
      setReplacementSerial('');
    },
  });

  // Handle clicking on RESERVED or DISPATCHED badge to view Site & SPOC info
  const handleStatusBadgeClick = async (e: React.MouseEvent, item: InventoryItem) => {
    e.stopPropagation();
    if (item.status === 'AVAILABLE') return;

    setLocationModalItem(item);
    setLoadingLocation(true);
    setLocationDetails(null);

    try {
      const res = await api.get(`/inventory/${item.id}`);
      const fullData = res.data.data;
      const latestDispatch = fullData.dispatches?.[0] || null;
      setLocationDetails(latestDispatch);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLocation(false);
    }
  };

  const handleExport = (type: 'excel' | 'pdf' | 'csv') => {
    const baseUrl = (import.meta as any).env?.VITE_API_URL || '/api';
    window.open(`${baseUrl}/inventory/export/${type}?search=${search}&store=${store !== 'All' ? store : ''}`, '_blank');
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setImportSummary(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('store', importStore);
      const res = await api.post('/inventory/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportSummary(res.data.data);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    } catch (err: any) {
      setImportSummary({ error: err.response?.data?.message || 'Import failed' });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Layout title="Spare Parts Inventory">
      {/* Action Header Container */}
      <div className="space-y-3 mb-5">
        {/* Row 1: Store Tabs on left + Import & Add Item on right corner */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex gap-1 p-1 bg-slate-900/80 border border-slate-800 rounded-xl">
            {(['All', 'Delhi', 'Bengaluru'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setStore(tab); setPage(1); }}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  store === tab
                    ? 'bg-brand-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {tab === 'All' ? 'All Stores' : `${tab} Store`}
              </button>
            ))}
          </div>

          {/* Right Corner: Import Excel & "+ Add Item" stacked neatly */}
          <div className="flex items-center gap-2.5 ml-auto">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setImportSummary(null); setImportModalOpen(true); }}
              icon={<Upload className="w-3.5 h-3.5" />}
            >
              Import Excel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/inventory/new')}
              icon={<Plus className="w-4 h-4" />}
              className="glow-brand"
            >
              Add Item
            </Button>
          </div>
        </div>

        {/* Row 2: Search Bar & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 bg-slate-900/60 border border-slate-800 rounded-2xl">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search Serial, Part Code, OEM..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filterSerialized}
              onChange={(e) => { setFilterSerialized(e.target.value); setPage(1); }}
              className="text-xs bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-brand-500"
            >
              <option value="">All Types</option>
              <option value="true">Serialized</option>
              <option value="false">Non-Serialized</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              className="text-xs bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-brand-500"
            >
              <option value="">All Status</option>
              <option value="AVAILABLE">Available</option>
              <option value="RESERVED">Reserved</option>
              <option value="DISPATCHED">Dispatched</option>
            </select>

            <Button variant="secondary" size="sm" onClick={() => handleExport('excel')} icon={<Download className="w-3.5 h-3.5" />}>
              Export Excel
            </Button>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm data-table">
            <thead>
              <tr>
                <th className="p-3.5 w-14 text-center">S.No.</th>
                <th className="p-3.5">OEM</th>
                <th className="p-3.5">Part Name / Model</th>
                <th className="p-3.5">Part Code</th>
                <th className="p-3.5">Serial Number</th>
                <th className="p-3.5">Type</th>
                <th className="p-3.5">Avail Qty</th>
                <th className="p-3.5">Store</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-brand-500" />
                      <span className="text-sm">Loading inventory...</span>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="w-8 h-8 text-slate-700" />
                      <span>No inventory items found. Click "Add Item" or "Import Excel" to get started.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item, index) => {
                  const sequenceNo = ((page - 1) * 15) + index + 1;
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/inventory/${item.id}`)}
                    >
                      {/* S.No. (Sequence Number) */}
                      <td className="p-3.5 font-mono text-xs text-slate-400 font-bold text-center">
                        {sequenceNo}
                      </td>
                      <td className="p-3.5 font-medium text-white whitespace-nowrap">{item.oem?.name || 'Unspecified OEM'}</td>
                      <td className="p-3.5">
                        <p className="font-semibold text-slate-100">{item.productName}</p>
                        {item.model && <p className="text-xs text-slate-500">{item.model}</p>}
                      </td>
                      <td className="p-3.5 font-mono text-xs text-slate-300">{item.partCode || 'Standard Part'}</td>

                      {/* Serial Number */}
                      <td className="p-3.5 font-mono text-xs text-white font-bold whitespace-nowrap">
                        {item.isSerialized && item.serialNumber ? (
                          <span className="bg-brand-500/10 text-brand-400 px-2 py-0.5 rounded border border-brand-500/20 font-bold">
                            {item.serialNumber}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic bg-slate-900 px-2 py-0.5 rounded text-[11px]">
                            Bulk Item
                          </span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <Badge variant={item.isSerialized ? 'info' : 'default'}>
                          {item.isSerialized ? 'Serialized' : 'Non-Serial'}
                        </Badge>
                      </td>

                      <td className="p-3.5">
                        <span className={`font-bold ${item.availableQuantity === 0 ? 'text-rose-400' : item.availableQuantity <= 2 ? 'text-amber-400' : 'text-white'}`}>
                          {item.availableQuantity}
                        </span>
                        <span className="text-slate-500 text-xs"> / {item.quantity} {item.unit}</span>
                      </td>

                      <td className="p-3.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.store === 'Delhi' ? 'bg-blue-500/15 text-blue-400' : 'bg-orange-500/15 text-orange-400'}`}>
                          {item.store} Store
                        </span>
                      </td>

                      {/* Interactive Status Badge & Manual Selector */}
                      <td className="p-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => handleStatusBadgeClick(e, item)}
                            className="hover:scale-105 transition-transform"
                            title={item.status !== 'AVAILABLE' ? 'Click to view Dispatched/Reserved Site Location, Date & Time, and SPOC' : 'Status'}
                          >
                            <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                          </button>
                          {/* Manual Status Control */}
                          <select
                            value={item.status}
                            onChange={(e) => updateStatusMutation.mutate({ id: item.id, status: e.target.value })}
                            className="text-[10px] bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-slate-300 focus:outline-none focus:border-brand-500 cursor-pointer"
                            title="Manually change status"
                          >
                            <option value="AVAILABLE">Available</option>
                            <option value="RESERVED">Reserved</option>
                            <option value="DISPATCHED">Dispatched</option>
                          </select>
                        </div>
                      </td>

                      <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {/* Replacement Part Button if Dispatched / Reserved */}
                          {item.status !== 'AVAILABLE' && (
                            <button
                              onClick={() => { setReplacementModalItem(item); setReplacementSerial(''); }}
                              className="p-1.5 rounded bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white transition-colors text-xs flex items-center gap-1"
                              title="Add Replacement Serial Part"
                            >
                              <Plus className="w-3 h-3" />
                              <span className="text-[10px] font-semibold">New Serial</span>
                            </button>
                          )}
                          <button
                            onClick={() => navigate(`/inventory/${item.id}`)}
                            className="p-1.5 rounded bg-slate-800 hover:bg-brand-600 text-slate-300 hover:text-white transition-colors"
                            title="View / Edit Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {item.qrCode && (
                            <button
                              onClick={() => setQrModalItem(item)}
                              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                              title="View QR Code"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                            </button>
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

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 mt-1">
            <p className="text-xs text-slate-500">
              Showing {((page - 1) * 15) + 1}–{Math.min(page * 15, pagination.total)} of {pagination.total} items
            </p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} icon={<ChevronLeft className="w-3.5 h-3.5" />}>
                Prev
              </Button>
              <span className="text-xs text-slate-400 px-2">{page} / {pagination.totalPages}</span>
              <Button variant="secondary" size="sm" disabled={!pagination.hasNext} onClick={() => setPage(p => p + 1)}>
                Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Dispatched / Reserved Site Location & SPOC Details Modal */}
      <Modal isOpen={!!locationModalItem} onClose={() => setLocationModalItem(null)} title="Reserved Site Location & SPOC Details" maxWidth="lg">
        {locationModalItem && (
          <div className="space-y-4">
            {/* Top Item Summary */}
            <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">{locationModalItem.productName}</p>
                <p className="text-xs text-brand-400 font-mono mt-0.5">
                  SN: {locationModalItem.serialNumber || 'Bulk Unit'} · OEM: {locationModalItem.oem?.name || 'Unspecified OEM'}
                </p>
              </div>
              <Badge variant={statusVariant(locationModalItem.status)}>{locationModalItem.status}</Badge>
            </div>

            {loadingLocation ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-500" />
                Fetching site location &amp; SPOC details...
              </div>
            ) : locationDetails ? (
              <div className="space-y-3 p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-brand-400" />
                  Reserved BHEL Site Location &amp; SPOC Details
                </p>

                {/* Date & Time Header Bar */}
                <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-slate-400">Reserved Date &amp; Time:</span>
                    <span className="font-semibold text-white">
                      {locationDetails.dispatchDate ? (
                        `${new Date(locationDetails.dispatchDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, ${new Date(locationDetails.createdAt || locationDetails.dispatchDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
                      ) : (
                        new Date(locationDetails.createdAt).toLocaleString('en-IN')
                      )}
                    </span>
                  </div>
                  {locationDetails.dispatchNo && (
                    <span className="font-mono text-cyan-400 font-bold">{locationDetails.dispatchNo}</span>
                  )}
                </div>

                {/* Site & Class */}
                <div className="flex items-center justify-between bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
                  <div>
                    <p className="font-bold text-white text-sm">{locationDetails.site?.siteName}</p>
                    {locationDetails.site?.unitDivision && (
                      <p className="text-[11px] text-slate-400 mt-0.5">Division: {locationDetails.site?.unitDivision}</p>
                    )}
                  </div>
                  {locationDetails.site?.locationClass && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                      Class {locationDetails.site?.locationClass}
                    </span>
                  )}
                </div>

                {/* Address & SPOC */}
                <div className="space-y-2 text-xs text-slate-300 pt-1">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                    <span>
                      {locationDetails.site?.fullAddress || `${locationDetails.site?.city || ''}${locationDetails.site?.state ? `, ${locationDetails.site.state}` : ''}`}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/60">
                    {locationDetails.site?.contactPerson && (
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <div>
                          <p className="text-[10px] text-slate-500">Site SPOC</p>
                          <p className="font-semibold text-slate-200">{locationDetails.site.contactPerson}</p>
                        </div>
                      </div>
                    )}
                    {locationDetails.site?.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <div>
                          <p className="text-[10px] text-slate-500">Phone</p>
                          <p className="font-mono text-slate-300">{locationDetails.site.phone}</p>
                        </div>
                      </div>
                    )}
                    {locationDetails.site?.email && (
                      <div className="flex items-center gap-2 col-span-2">
                        <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <p className="text-slate-300">{locationDetails.site.email}</p>
                      </div>
                    )}
                  </div>

                  {(locationDetails.courierName || locationDetails.trackingNo) && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                      <Truck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="text-slate-300">Courier: {locationDetails.courierName || 'Courier Partner'} (AWB #{locationDetails.trackingNo || 'N/A'})</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400">
                Item status is currently set to <strong className="text-white">{locationModalItem.status}</strong> via status control override.
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <Button
                variant="outline"
                size="sm"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => {
                  const item = locationModalItem;
                  setLocationModalItem(null);
                  setReplacementModalItem(item);
                  setReplacementSerial('');
                }}
              >
                Add Replacement Serial Part
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setLocationModalItem(null)}>
                Close Details
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Replacement Serial Part Modal */}
      <Modal isOpen={!!replacementModalItem} onClose={() => setReplacementModalItem(null)} title="Add Replacement Serial Spare Part" maxWidth="md">
        {replacementModalItem && (
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              Add a new incoming spare unit for <span className="font-semibold text-white">{replacementModalItem.productName}</span> to inventory with identical OEM, model, and category fields.
            </p>

            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1 text-xs">
              <p className="text-slate-400">OEM: <span className="text-white font-semibold">{replacementModalItem.oem?.name}</span></p>
              <p className="text-slate-400">Part Code: <span className="text-brand-400 font-mono">{replacementModalItem.partCode}</span></p>
              <p className="text-slate-400">Store: <span className="text-white">{replacementModalItem.store} Store</span></p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">New Serial Number *</label>
              <input
                type="text"
                placeholder="Enter new unit serial number (e.g. GK65R99)..."
                value={replacementSerial}
                onChange={(e) => setReplacementSerial(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-brand-500/50 rounded-xl text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button variant="secondary" size="sm" onClick={() => setReplacementModalItem(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<Check className="w-3.5 h-3.5" />}
                onClick={() => createReplacementMutation.mutate(replacementModalItem)}
                isLoading={createReplacementMutation.isPending}
                disabled={!replacementSerial.trim()}
              >
                Save Replacement Part
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* QR Modal */}
      <Modal isOpen={!!qrModalItem} onClose={() => setQrModalItem(null)} title={`QR Code — ${qrModalItem?.serialNumber || qrModalItem?.spareId}`} maxWidth="sm">
        {qrModalItem && (
          <div className="text-center p-4">
            <img src={qrModalItem.qrCode} alt="QR Code" className="w-48 h-48 mx-auto bg-white p-2 rounded-xl border border-slate-700 mb-4" />
            <p className="font-mono text-sm font-bold text-brand-400">{qrModalItem.serialNumber || qrModalItem.spareId}</p>
            <p className="text-xs text-slate-300 font-medium mt-1">{qrModalItem.productName}</p>
            <p className="text-xs text-slate-500 mt-0.5">OEM: {qrModalItem.oem?.name}</p>
            <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={() => window.print()}>
              Print QR Label
            </Button>
          </div>
        )}
      </Modal>

      {/* Import Excel Modal */}
      <Modal isOpen={importModalOpen} onClose={() => setImportModalOpen(false)} title="Import Inventory Excel" maxWidth="md">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Target Store</label>
            <div className="flex gap-3">
              {(['Delhi', 'Bengaluru'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setImportStore(s)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                    importStore === s
                      ? 'bg-brand-600 border-brand-500 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {s} Store
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Upload Excel File (.xlsx / .xls)</label>
            <div
              className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center cursor-pointer hover:border-brand-500 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Click to select Excel file</p>
              <p className="text-xs text-slate-600 mt-1">Supports .xlsx and .xls formats</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileImport}
            />
          </div>

          {isImporting && (
            <div className="flex items-center gap-3 p-3 bg-brand-500/10 border border-brand-500/20 rounded-xl">
              <RefreshCw className="w-4 h-4 text-brand-400 animate-spin shrink-0" />
              <span className="text-sm text-brand-300">Importing Excel data...</span>
            </div>
          )}

          {importSummary && !importSummary.error && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Import Completed
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900/60 rounded-lg p-2">
                  <p className="text-slate-500">Total Rows</p>
                  <p className="font-bold text-white">{importSummary.totalRows}</p>
                </div>
                <div className="bg-slate-900/60 rounded-lg p-2">
                  <p className="text-slate-500">Imported</p>
                  <p className="font-bold text-emerald-400">{importSummary.imported}</p>
                </div>
                <div className="bg-slate-900/60 rounded-lg p-2">
                  <p className="text-slate-500">Updated</p>
                  <p className="font-bold text-blue-400">{importSummary.updated}</p>
                </div>
                <div className="bg-slate-900/60 rounded-lg p-2">
                  <p className="text-slate-500">Skipped / Failed</p>
                  <p className="font-bold text-amber-400">{importSummary.skipped} / {importSummary.failed}</p>
                </div>
              </div>
            </div>
          )}

          {importSummary?.error && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <p className="text-sm text-rose-400">{importSummary.error}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={() => setImportModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
};
