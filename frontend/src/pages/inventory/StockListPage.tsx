import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Plus, Download, Upload, QrCode, Eye,
  ChevronLeft, ChevronRight, X, AlertTriangle, CheckCircle2,
  Package, RefreshCw, FileUp, Building2, MapPin, User, Phone, Mail,
  Truck, Check, Clock, Tag, Cpu, Archive
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useOrganization } from '../../context/OrganizationContext';
import api from '../../api';
import { Layout } from '../../components/layout';
import { Button, Card, Badge, Modal } from '../../components/ui';
import { InventoryItem } from '../../types';
import { isRealSerial } from '../../utils/serialUtils';

const statusVariant = (s: string): 'success' | 'danger' | 'warning' | 'default' =>
  s === 'AVAILABLE' ? 'success' : s === 'DISPATCHED' ? 'danger' : 'warning';

export const StockListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { selectedOrg, organizations } = useOrganization();
  const activeOrgObj = organizations.find((o) => o.id === selectedOrg) || { id: 'BHEL', name: 'BHEL' };

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
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Location / Reserved Info Modal State
  const [locationModalItem, setLocationModalItem] = useState<InventoryItem | null>(null);
  const [locationDetails, setLocationDetails] = useState<any>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Add Replacement Serial Modal State
  const [replacementModalItem, setReplacementModalItem] = useState<InventoryItem | null>(null);
  const [replacementSerial, setReplacementSerial] = useState('');

  // Re-Stocking Modal State
  const [restockModalItem, setRestockModalItem] = useState<InventoryItem | null>(null);
  const [restockSerial, setRestockSerial] = useState('');
  const [restockQty, setRestockQty] = useState(1);
  const [restockRemarks, setRestockRemarks] = useState('');

  const restockMutation = useMutation({
    mutationFn: async (payload: { id: string; newSerialNo?: string; serialNo?: string; serialNumber?: string; quantity?: number; pcs?: number; remarks?: string }) => {
      const res = await api.patch(`/stock/${payload.id}/replenish`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setToastMessage(data?.message || 'Stock item successfully re-stocked and status set to AVAILABLE.');
      setTimeout(() => setToastMessage(null), 4000);
      setRestockModalItem(null);
      setRestockSerial('');
      setRestockQty(1);
      setRestockRemarks('');
    },
  });

  // Add Spare Part Modal State
  const [addItemModalOpen, setAddItemModalOpen] = useState(false);
  const [newItemForm, setNewItemForm] = useState({
    productName: '',
    partCode: '',
    oemId: '',
    categoryId: '',
    store: 'Delhi',
    quantity: 1,
    unit: 'PCS',
    serialNumber: '',
    isSerialized: false,
    rack: '',
    bin: '',
    condition: 'NEW',
    warrantyStart: '',
    warrantyEnd: '',
    remarks: '',
  });

  // Register + New Serial No Modal State
  const [newSerialModalOpen, setNewSerialModalOpen] = useState(false);
  const [newSerialForm, setNewSerialForm] = useState({
    oemId: '',
    categoryId: '',
    productName: '',
    partCode: '',
    partId: '',
    serialNumber: '',
    store: 'Delhi',
    remarks: '',
  });

  const resetNewItemForm = () => {
    setNewItemForm({
      productName: '',
      partCode: '',
      oemId: '',
      categoryId: '',
      store: 'Delhi',
      quantity: 1,
      unit: 'PCS',
      serialNumber: '',
      isSerialized: false,
      rack: '',
      bin: '',
      condition: 'NEW',
      warrantyStart: '',
      warrantyEnd: '',
      remarks: '',
    });
  };

  const { data: oemsData } = useQuery({
    queryKey: ['oems'],
    queryFn: async () => {
      const res = await api.get('/inventory/oems');
      return res.data.data;
    },
  });

  const createItemMutation = useMutation({
    mutationFn: async (payload: typeof newItemForm) => {
      const res = await api.post('/inventory', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setAddItemModalOpen(false);
      resetNewItemForm();
    },
  });

  const newSerialMutation = useMutation({
    mutationFn: async (payload: typeof newSerialForm) => {
      const res = await api.post('/inventory/new-serial', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setNewSerialModalOpen(false);
      setNewSerialForm({
        oemId: '',
        categoryId: '',
        productName: '',
        partCode: '',
        partId: '',
        serialNumber: '',
        store: 'Delhi',
        remarks: '',
      });
    },
  });

  // Handle deep link ?action=import or ?filter=low_stock from Dashboard Quick Action
  useEffect(() => {
    if (searchParams.get('action') === 'import') {
      setImportSummary(null);
      setImportModalOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams);
    }
    const filterParam = searchParams.get('filter');
    const searchParam = searchParams.get('search');
    const focusParam = searchParams.get('focus');
    if (filterParam === 'low_stock' || filterParam === 'LOW_STOCK') {
      setFilterStatus('LOW_STOCK');
    } else if (filterParam === 'out_of_stock' || filterParam === 'OUT_OF_STOCK') {
      setFilterStatus('OUT_OF_STOCK');
    }
    if (searchParam) {
      setSearch(searchParam);
    }
    if (focusParam === 'search') {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [searchParams, setSearchParams]);

  const params: any = { search, page, limit: 15 };
  if (store !== 'All') params.store = store;
  if (filterSerialized) params.isSerialized = filterSerialized;
  if (filterStatus) params.status = filterStatus;

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', params, selectedOrg],
    queryFn: async () => {
      const res = await api.get('/inventory', { params });
      return res.data;
    },
  });

  const items: InventoryItem[] = data?.data || [];
  const pagination = data?.pagination;

  // Mutation for Manual Status Override
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

  // Mutation for In-Place Serial Number Replacement
  const createReplacementMutation = useMutation({
    mutationFn: async (baseItem: InventoryItem) => {
      const payload = {
        itemId: baseItem.id,
        productName: baseItem.productName,
        partCode: baseItem.partCode,
        oemId: baseItem.oemId,
        serialNumber: replacementSerial.trim(),
        originalSerialNumber: baseItem.serialNumber || 'N/A',
        remarks: `Replacement serial number registered for ${baseItem.spareId}`,
      };
      const res = await api.post('/inventory/replace-serial', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setReplacementModalItem(null);
      setReplacementSerial('');
    },
  });

  // Handle Excel File Import
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportSummary(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('store', importStore);

    try {
      const res = await api.post('/inventory/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportSummary(res.data.data);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    } catch (err: any) {
      setImportSummary({ error: err.response?.data?.message || 'Failed to import Excel file' });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Fetch Dispatched / Reserved Site Location & SPOC Details
  const handleStatusBadgeClick = async (e: React.MouseEvent, item: InventoryItem) => {
    e.stopPropagation();
    if (item.status === 'AVAILABLE') return;

    setLocationModalItem(item);
    setLoadingLocation(true);
    setLocationDetails(null);

    try {
      const res = await api.get(`/inventory/${item.id}/location-details`);
      setLocationDetails(res.data.data);
    } catch (err) {
      console.error('Location details error:', err);
    } finally {
      setLoadingLocation(false);
    }
  };

  return (
    <Layout title="Stock List Master">
      {/* Success Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 border border-emerald-500 toast text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-white" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-white/80 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Controls Header */}
      <div className="space-y-4 mb-6">
        {/* Row 1: Warehouse Tabs & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 border border-slate-200 rounded-xl">
            {selectedOrg === 'BHEL' ? (
              (['All', 'Delhi', 'Bengaluru'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => { setStore(s); setPage(1); }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    store === s
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {s === 'All' ? '🏬 All Warehouses' : s === 'Delhi' ? '📍 Delhi Store' : '📍 Bengaluru Store'}
                </button>
              ))
            ) : (
              (['All', 'Main'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => { setStore(s === 'All' ? 'All' : 'Delhi'); setPage(1); }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    store === (s === 'All' ? 'All' : 'Delhi')
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {s === 'All' ? '🏬 All Warehouses' : `📍 ${activeOrgObj.name} Store`}
                </button>
              ))
            )}
          </div>

          {(user?.role === 'SUPER_ADMIN' || user?.role === 'INVENTORY_ADMIN') && (
            <div className="flex items-center gap-2.5 ml-auto">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setImportSummary(null); setImportModalOpen(true); }}
                icon={<Upload className="w-3.5 h-3.5" />}
              >
                Import Stock List
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setAddItemModalOpen(true)}
                icon={<Plus className="w-4 h-4" />}
              >
                Add Item
              </Button>
            </div>
          )}
        </div>

        {/* Row 2: Search Bar & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search Serial, Part Code, OEM..."
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

          <div className="flex items-center gap-2.5 flex-wrap">
            <select
              value={filterSerialized}
              onChange={(e) => { setFilterSerialized(e.target.value); setPage(1); }}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-600 cursor-pointer"
            >
              <option value="">All Serial Types</option>
              <option value="true">Serialized Only</option>
              <option value="false">Non-Serialized (Bulk)</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-600 cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="LOW_STOCK">⚠️ Low Stock Items</option>
              <option value="OUT_OF_STOCK">❌ Out of Stock</option>
              <option value="AVAILABLE">Available</option>
              <option value="RESERVED">Reserved</option>
              <option value="DISPATCHED">Dispatched</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Stock Table */}
      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs data-table">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <th className="p-3.5 text-center w-12">S.No</th>
                <th className="p-3.5">OEM</th>
                <th className="p-3.5">Spare Product Name</th>
                <th className="p-3.5">Part Code</th>
                <th className="p-3.5">Serial Number</th>
                <th className="p-3.5">Type</th>
                <th className="p-3.5">Stock Level</th>
                <th className="p-3.5">Warehouse Store</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-900">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500 font-semibold">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                    Loading stock list...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500 font-semibold">
                    <Package className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                    No stock items found matching your filters.
                  </td>
                </tr>
              ) : (
                items.map((item, index) => {
                  const sequenceNo = ((page - 1) * 15) + index + 1;
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/inventory/${item.id}`)}
                    >
                      <td className="p-3.5 font-mono text-xs text-slate-700 font-bold text-center">
                        {sequenceNo}
                      </td>
                      <td className="p-3.5 font-bold text-slate-900 whitespace-nowrap">{item.oem?.name || 'Unspecified OEM'}</td>
                      <td className="p-3.5">
                        <p className="font-bold text-slate-900">{item.productName}</p>
                        {item.model && <p className="text-xs text-slate-500 font-medium">{item.model}</p>}
                      </td>
                      <td className="p-3.5 font-mono text-xs text-slate-700 font-semibold">{item.partCode || 'Standard Part'}</td>

                      <td className="p-3.5 font-mono text-xs font-bold whitespace-nowrap">
                        {item.isSerialized && isRealSerial(item.serialNumber) ? (
                          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 font-bold">
                            {item.serialNumber}
                          </span>
                        ) : (
                          <span className="text-slate-600 italic bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200">
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
                        <span className={`font-bold ${item.availableQuantity === 0 ? 'text-rose-600' : item.availableQuantity <= (item.quantity * 0.5) ? 'text-amber-600' : 'text-slate-900'}`}>
                          {item.availableQuantity}
                        </span>
                        <span className="text-slate-500 text-xs font-medium"> / {item.quantity} {item.unit}</span>
                      </td>

                      <td className="p-3.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.store === 'Delhi' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-orange-50 text-orange-700 border border-orange-200'}`}>
                          {item.store} Store
                        </span>
                      </td>

                      <td className="p-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => handleStatusBadgeClick(e, item)}
                            className="hover:scale-105 transition-transform"
                            title={item.status !== 'AVAILABLE' ? 'Click to view Location details' : 'Status'}
                          >
                            <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                          </button>
                          {(user?.role === 'SUPER_ADMIN' || user?.role === 'INVENTORY_ADMIN') && (
                            <select
                              value={item.status}
                              onChange={(e) => updateStatusMutation.mutate({ id: item.id, status: e.target.value })}
                              className="text-[10px] bg-white border border-slate-300 rounded px-1.5 py-0.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-600 cursor-pointer"
                            >
                              <option value="AVAILABLE">Available</option>
                              <option value="RESERVED">Reserved</option>
                              <option value="DISPATCHED">Dispatched</option>
                            </select>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {item.status !== 'AVAILABLE' && (
                            <button
                              onClick={() => {
                                setRestockModalItem(item);
                                setRestockSerial(item.serialNumber || '');
                                setRestockQty(1);
                                setRestockRemarks('');
                              }}
                              className="p-1.5 rounded bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-300 transition-colors text-xs flex items-center gap-1 font-bold shadow-sm"
                              title="Re-Stock / Add Serial - Reset Status to AVAILABLE"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span className="text-[10px]">Re-Stock / Add Serial</span>
                            </button>
                          )}
                          <button
                            onClick={() => navigate(`/inventory/${item.id}`)}
                            className="p-1.5 rounded bg-slate-100 hover:bg-indigo-600 text-slate-700 hover:text-white border border-slate-200 transition-colors"
                            title="View / Edit Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {user?.role === 'SUPER_ADMIN' && (
                            <button
                              onClick={async () => {
                                if (window.confirm(`Are you sure you want to archive "${item.productName}"?`)) {
                                  try {
                                    await api.post(`/inventory/${item.id}/archive`);
                                    queryClient.invalidateQueries({ queryKey: ['inventory'] });
                                  } catch (err: any) {
                                    alert(err?.response?.data?.message || 'Failed to archive item');
                                  }
                                }
                              }}
                              className="p-1.5 rounded bg-slate-100 hover:bg-rose-600 text-slate-700 hover:text-white border border-slate-200 transition-colors"
                              title="Archive Part"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {item.qrCode && (
                            <button
                              onClick={() => setQrModalItem(item)}
                              className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 mt-1 bg-slate-50">
            <p className="text-xs text-slate-600 font-medium">
              Showing {((page - 1) * 15) + 1}–{Math.min(page * 15, pagination.total)} of {pagination.total} items
            </p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} icon={<ChevronLeft className="w-3.5 h-3.5" />}>
                Prev
              </Button>
              <span className="text-xs text-slate-800 font-bold px-2">{page} / {pagination.totalPages}</span>
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
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">{locationModalItem.productName}</p>
                <p className="text-xs text-indigo-600 font-mono font-bold mt-0.5">
                  SN: {locationModalItem.serialNumber || 'Bulk Unit'} · OEM: {locationModalItem.oem?.name || 'Unspecified OEM'}
                </p>
              </div>
              <Badge variant={statusVariant(locationModalItem.status)}>{locationModalItem.status}</Badge>
            </div>

            {loadingLocation ? (
              <div className="text-center py-8 text-slate-500 text-xs font-semibold">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                Fetching site location &amp; SPOC details...
              </div>
            ) : locationDetails ? (
              <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                  Site &amp; Store Location
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 font-medium">BHEL Site Name:</span>
                    <p className="font-bold text-slate-900">{locationDetails.site?.siteName || '—'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">City / State:</span>
                    <p className="font-bold text-slate-900">{locationDetails.site?.city || '—'}, {locationDetails.site?.state || '—'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-bold">
                No active dispatch or reservation record linked with this stock item.
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Stock List Import Modal */}
      <Modal isOpen={importModalOpen} onClose={() => setImportModalOpen(false)} title="Import Stock List Excel" maxWidth="md">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">Target Warehouse Store *</label>
            <select
              value={importStore}
              onChange={(e) => setImportStore(e.target.value as any)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
            >
              <option value="Delhi">Delhi Warehouse Store</option>
              <option value="Bengaluru">Bengaluru Warehouse Store</option>
            </select>
          </div>

          <div>
            <input type="file" ref={fileInputRef} accept=".xlsx,.xls" onChange={handleFileImport} className="hidden" />
            <Button
              variant="primary"
              size="md"
              className="w-full justify-center"
              onClick={() => fileInputRef.current?.click()}
              isLoading={isImporting}
              icon={<Upload className="w-4 h-4" />}
            >
              Select Stock Excel File
            </Button>
          </div>

          {importSummary && (
            <div className="p-3 bg-slate-100 rounded-xl text-xs space-y-1">
              <p className="font-bold text-slate-900">Total Rows: {importSummary.totalRows}</p>
              <p className="text-emerald-700 font-bold">Imported: {importSummary.imported}</p>
              <p className="text-indigo-700 font-bold">Updated: {importSummary.updated}</p>
              <p className="text-rose-700 font-bold">Failed: {importSummary.failed}</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Register + New Serial No Modal */}
      <Modal isOpen={newSerialModalOpen} onClose={() => setNewSerialModalOpen(false)} title="Register OEM Replacement (+ New Serial No)" maxWidth="md">
        <form onSubmit={(e) => { e.preventDefault(); newSerialMutation.mutate(newSerialForm); }} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">OEM Manufacturer *</label>
            <select
              required
              value={newSerialForm.oemId}
              onChange={(e) => setNewSerialForm({ ...newSerialForm, oemId: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
            >
              <option value="">Select OEM...</option>
              {(oemsData || []).map((o: any) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Product / Part Name *</label>
              <input
                type="text"
                required
                value={newSerialForm.productName}
                onChange={(e) => setNewSerialForm({ ...newSerialForm, productName: e.target.value })}
                placeholder="e.g. Cisco Catalyst Switch 9300"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Part Code / Part ID</label>
              <input
                type="text"
                value={newSerialForm.partCode}
                onChange={(e) => setNewSerialForm({ ...newSerialForm, partCode: e.target.value, partId: e.target.value })}
                placeholder="e.g. C9300-48P"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">New Serial Number *</label>
              <input
                type="text"
                required
                value={newSerialForm.serialNumber}
                onChange={(e) => setNewSerialForm({ ...newSerialForm, serialNumber: e.target.value })}
                placeholder="e.g. FOC24190ABC"
                className="w-full px-3 py-2 bg-white border border-slate-300 font-mono rounded-xl text-xs text-indigo-700 font-bold focus:outline-none focus:border-indigo-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Target Stock Store *</label>
              <select
                value={newSerialForm.store}
                onChange={(e) => setNewSerialForm({ ...newSerialForm, store: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
              >
                <option value="Delhi">Delhi Store</option>
                <option value="Bengaluru">Bengaluru Store</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">Remarks</label>
            <textarea
              rows={2}
              value={newSerialForm.remarks}
              onChange={(e) => setNewSerialForm({ ...newSerialForm, remarks: e.target.value })}
              placeholder="Remarks for replacement serial registration..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button variant="ghost" size="sm" type="button" onClick={() => setNewSerialModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={newSerialMutation.isPending}>
              Register New Serial
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add New Item Modal */}
      <Modal isOpen={addItemModalOpen} onClose={() => setAddItemModalOpen(false)} title="Add New Stock Item" maxWidth="lg">
        <form onSubmit={(e) => { e.preventDefault(); createItemMutation.mutate(newItemForm); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Spare Part Name *</label>
              <input
                type="text"
                required
                value={newItemForm.productName}
                onChange={(e) => setNewItemForm({ ...newItemForm, productName: e.target.value })}
                placeholder="e.g. Cisco Catalyst Switch 9300"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Part Code / Part ID</label>
              <input
                type="text"
                value={newItemForm.partCode}
                onChange={(e) => setNewItemForm({ ...newItemForm, partCode: e.target.value })}
                placeholder="e.g. C9300-48P"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">OEM Manufacturer *</label>
              <select
                required
                value={newItemForm.oemId}
                onChange={(e) => setNewItemForm({ ...newItemForm, oemId: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
              >
                <option value="">Select OEM...</option>
                {(oemsData || []).map((o: any) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Target Stock Store *</label>
              <select
                value={newItemForm.store}
                onChange={(e) => setNewItemForm({ ...newItemForm, store: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
              >
                <option value="Delhi">Delhi Store</option>
                <option value="Bengaluru">Bengaluru Store</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button variant="ghost" size="sm" type="button" onClick={() => setAddItemModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={createItemMutation.isPending}>
              Save Stock Item
            </Button>
          </div>
        </form>
      </Modal>

      {/* Re-Stock / Add Serial Modal */}
      <Modal isOpen={!!restockModalItem} onClose={() => setRestockModalItem(null)} title="Re-Stock / Add Serial Modal" maxWidth="md">
        {restockModalItem && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              restockMutation.mutate({
                id: restockModalItem.id,
                newSerialNo: restockSerial,
                serialNo: restockSerial,
                serialNumber: restockSerial,
                quantity: restockQty,
                pcs: restockQty,
                remarks: restockRemarks,
              });
            }}
            className="space-y-4"
          >
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950">
              <p className="font-bold flex items-center gap-1.5 mb-1">
                <RefreshCw className="w-4 h-4 text-emerald-600" />
                Re-Stocking Item to AVAILABLE Status:
              </p>
              <p className="font-semibold text-emerald-900">{restockModalItem.productName} ({restockModalItem.spareId})</p>
              <p className="text-[11px] text-emerald-700 mt-0.5">OEM: {restockModalItem.oem?.name} · Current Status: {restockModalItem.status}</p>
            </div>

            {restockModalItem.isSerialized ? (
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  New Serial Number *
                </label>
                <input
                  type="text"
                  required
                  value={restockSerial}
                  onChange={(e) => setRestockSerial(e.target.value)}
                  placeholder="Enter new serial number (e.g. SN-RSTK-998877)"
                  className="w-full px-3 py-2 bg-white border border-slate-300 font-mono text-xs font-bold text-indigo-700 rounded-xl focus:outline-none focus:border-indigo-600"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Quantity / Pcs to Add *
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={restockQty}
                  onChange={(e) => setRestockQty(parseInt(e.target.value, 10))}
                  placeholder="Enter quantity of pcs to add"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Remarks / Note (Optional)</label>
              <textarea
                rows={2}
                value={restockRemarks}
                onChange={(e) => setRestockRemarks(e.target.value)}
                placeholder="Enter any optional remarks or notes..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Button variant="ghost" size="sm" type="button" onClick={() => setRestockModalItem(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" isLoading={restockMutation.isPending}>
                Save &amp; Set Available
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </Layout>
  );
};
