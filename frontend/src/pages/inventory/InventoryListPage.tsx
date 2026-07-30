import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Plus, Download, Upload, QrCode, Eye,
  ChevronLeft, ChevronRight, X, AlertTriangle, CheckCircle2,
  Package, RefreshCw, FileUp, Building2, MapPin, User, Phone, Mail,
  Truck, Check, Clock, Tag, Cpu, History, FileSpreadsheet, Layers, Building,
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

  const [activeMainTab, setActiveMainTab] = useState<'stock-list' | 'location-inventory' | 'audit-logs'>('stock-list');

  // 15-Field Location Inventory Excel Upload State
  const [locImportModalOpen, setLocImportModalOpen] = useState(false);
  const [locImportSummary, setLocImportSummary] = useState<any>(null);
  const [isLocImporting, setIsLocImporting] = useState(false);
  const locFileInputRef = useRef<HTMLInputElement>(null);

  // Location Inventory Query State
  const [locSearch, setLocSearch] = useState('');
  const [locPage, setLocPage] = useState(1);

  // Audit Logs Query State
  const [auditSearch, setAuditSearch] = useState('');
  const [auditPage, setAuditPage] = useState(1);

  // New OEM Serial Entry Modal State
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

  // OEMs Query for New Serial Form
  const { data: oemsData } = useQuery({
    queryKey: ['oems'],
    queryFn: async () => {
      const res = await api.get('/inventory/oems');
      return res.data.data;
    },
  });

  // Location Inventory Query (15-field spec)
  const { data: locData, isLoading: locLoading } = useQuery({
    queryKey: ['location-inventory', locSearch, locPage],
    queryFn: async () => {
      const res = await api.get('/inventory/location-inventory', {
        params: { search: locSearch, page: locPage, limit: 15 },
      });
      return res.data;
    },
    enabled: activeMainTab === 'location-inventory',
  });

  const locationItems = locData?.data || [];
  const locPagination = locData?.pagination;

  // Swap Tracking & Audit Logs Query
  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['replacement-audit-logs', auditSearch, auditPage],
    queryFn: async () => {
      const res = await api.get('/inventory/replacement-audit-logs', {
        params: { search: auditSearch, page: auditPage, limit: 15 },
      });
      return res.data;
    },
    enabled: activeMainTab === 'audit-logs',
  });

  const auditLogs = auditData?.data || [];
  const auditPagination = auditData?.pagination;

  // New Serial Registration Mutation
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

  // Handle 15-Field Location Inventory Excel File Import
  const handleLocFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLocImporting(true);
    setLocImportSummary(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/inventory/location-inventory/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setLocImportSummary(res.data.data);
      queryClient.invalidateQueries({ queryKey: ['location-inventory'] });
    } catch (err: any) {
      setLocImportSummary({
        errors: [{ row: 1, reason: err.response?.data?.message || 'Failed to parse 15-field Excel file' }],
      });
    } finally {
      setIsLocImporting(false);
      if (locFileInputRef.current) locFileInputRef.current.value = '';
    }
  };

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

  // Mutation for In-Place Serial Number Replacement (NO duplicate creation)
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

  // Export Inventory Handler
  const handleExport = async (format: 'excel' | 'pdf') => {
    try {
      const response = await api.get('/reports/export-inventory', {
        params: { format, store: store !== 'All' ? store : undefined },
        responseType: 'blob',
      });
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Inventory_Report_${store}_${Date.now()}.${format === 'excel' ? 'xlsx' : 'pdf'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export error:', err);
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
      {/* Main Feature Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-5 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveMainTab('stock-list')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeMainTab === 'stock-list'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Package className="w-4 h-4" />
          Stock List Master
        </button>
        <button
          onClick={() => setActiveMainTab('location-inventory')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeMainTab === 'location-inventory'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Location Inventory (15-Field Spec)
        </button>
        <button
          onClick={() => setActiveMainTab('audit-logs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeMainTab === 'audit-logs'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          Swap Tracking / Audit History
        </button>

        <div className="flex items-center gap-2 ml-auto">
          {activeMainTab === 'stock-list' && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setLocImportSummary(null); setLocImportModalOpen(true); }}
                icon={<FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />}
              >
                Upload 15-Field Inventory Excel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setNewSerialModalOpen(true)}
                icon={<Plus className="w-3.5 h-3.5 text-emerald-600" />}
              >
                + New Serial No
              </Button>
            </>
          )}

          {activeMainTab === 'location-inventory' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => { setLocImportSummary(null); setLocImportModalOpen(true); }}
              icon={<FileSpreadsheet className="w-3.5 h-3.5" />}
            >
              Upload 15-Field Excel
            </Button>
          )}
        </div>
      </div>

      {activeMainTab === 'stock-list' && (
        <>
          {/* Top Controls Header */}
          <div className="space-y-4 mb-6">
            {/* Row 1: Warehouse Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 border border-slate-200 rounded-xl">
                {(['All', 'Delhi', 'Bengaluru'] as const).map((s) => (
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
                ))}
              </div>

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
            </div>

        {/* Row 2: Search Bar & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
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

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filterSerialized}
              onChange={(e) => { setFilterSerialized(e.target.value); setPage(1); }}
              className="text-xs bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-slate-900 font-semibold focus:outline-none focus:border-indigo-600"
            >
              <option value="">All Types</option>
              <option value="true">Serialized</option>
              <option value="false">Non-Serialized</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              className="text-xs bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-slate-900 font-semibold focus:outline-none focus:border-indigo-600"
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
            <tbody className="divide-y divide-slate-200 text-slate-900">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                      <span className="text-sm font-semibold">Loading stock list...</span>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="w-8 h-8 text-slate-400" />
                      <span className="font-semibold text-slate-700">No stock items found. Click "Add Item" or "Import Excel" to get started.</span>
                    </div>
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
                      {/* S.No. (Sequence Number) */}
                      <td className="p-3.5 font-mono text-xs text-slate-700 font-bold text-center">
                        {sequenceNo}
                      </td>
                      <td className="p-3.5 font-bold text-slate-900 whitespace-nowrap">{item.oem?.name || 'Unspecified OEM'}</td>
                      <td className="p-3.5">
                        <p className="font-bold text-slate-900">{item.productName}</p>
                        {item.model && <p className="text-xs text-slate-500 font-medium">{item.model}</p>}
                      </td>
                      <td className="p-3.5 font-mono text-xs text-slate-700 font-semibold">{item.partCode || 'Standard Part'}</td>

                      {/* Serial Number */}
                      <td className="p-3.5 font-mono text-xs font-bold whitespace-nowrap">
                        {item.isSerialized && item.serialNumber ? (
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
                        <span className={`font-bold ${item.availableQuantity === 0 ? 'text-rose-600' : item.availableQuantity <= 2 ? 'text-amber-600' : 'text-slate-900'}`}>
                          {item.availableQuantity}
                        </span>
                        <span className="text-slate-500 text-xs font-medium"> / {item.quantity} {item.unit}</span>
                      </td>

                      <td className="p-3.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.store === 'Delhi' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-orange-50 text-orange-700 border border-orange-200'}`}>
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
                            className="text-[10px] bg-white border border-slate-300 rounded px-1.5 py-0.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-600 cursor-pointer"
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
                              className="p-1.5 rounded bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 transition-colors text-xs flex items-center gap-1"
                              title="Add Replacement Serial Part"
                            >
                              <Plus className="w-3 h-3" />
                              <span className="text-[10px] font-bold">New Serial</span>
                            </button>
                          )}
                          <button
                            onClick={() => navigate(`/inventory/${item.id}`)}
                            className="p-1.5 rounded bg-slate-100 hover:bg-indigo-600 text-slate-700 hover:text-white border border-slate-200 transition-colors"
                            title="View / Edit Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
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
      </>
      )}

      {/* Installed Location Inventory View */}
      {activeMainTab === 'location-inventory' && (
        <Card title="Installed Location Inventory Master (15-Field Specification)">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search Serial, Part ID, Room ID, Building..."
                value={locSearch}
                onChange={(e) => { setLocSearch(e.target.value); setLocPage(1); }}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-600"
              />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="info">Total Installed: {locPagination?.total || locationItems.length}</Badge>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">State</th>
                  <th className="p-3">Building Name</th>
                  <th className="p-3">Room ID &amp; Name</th>
                  <th className="p-3">OEM</th>
                  <th className="p-3">Part ID</th>
                  <th className="p-3">Part Serial No.</th>
                  <th className="p-3">Location Class</th>
                  <th className="p-3">Solution Type</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {locLoading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500 font-semibold">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                      Loading location inventory...
                    </td>
                  </tr>
                ) : locationItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500 font-semibold">
                      No installed location inventory items found. Upload 15-field Excel file to import.
                    </td>
                  </tr>
                ) : (
                  locationItems.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-bold text-slate-900">{item.state}</td>
                      <td className="p-3 font-semibold text-slate-800">{item.buildingName}</td>
                      <td className="p-3">
                        <p className="font-bold text-indigo-900">{item.roomId}</p>
                        <p className="text-[11px] text-slate-500">{item.roomName}</p>
                      </td>
                      <td className="p-3 text-slate-700 font-medium">{item.oem}</td>
                      <td className="p-3 font-mono font-bold text-slate-900">{item.partId}</td>
                      <td className="p-3 font-mono font-bold text-indigo-700">
                        <span className="bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {item.partSerialNo}
                        </span>
                      </td>
                      <td className="p-3 text-slate-700 font-medium">{item.locationClass}</td>
                      <td className="p-3 text-slate-700 font-medium">{item.solutionType}</td>
                      <td className="p-3">
                        <Badge variant={item.status === 'INSTALLED' ? 'success' : 'warning'}>
                          {item.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {locPagination && locPagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 mt-2 bg-slate-50">
              <p className="text-xs text-slate-600 font-medium">
                Showing {((locPage - 1) * 15) + 1}–{Math.min(locPage * 15, locPagination.total)} of {locPagination.total} items
              </p>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" disabled={locPage <= 1} onClick={() => setLocPage(p => p - 1)}>
                  Prev
                </Button>
                <span className="text-xs text-slate-800 font-bold px-2">{locPage} / {locPagination.totalPages}</span>
                <Button variant="secondary" size="sm" disabled={!locPagination.hasNext} onClick={() => setLocPage(p => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Faulty Serial Swap Tracking & Audit History View */}
      {activeMainTab === 'audit-logs' && (
        <Card title="Faulty Serial Swap Tracking & Audit History Log">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search Faulty SN, Spare SN, Room ID, State..."
                value={auditSearch}
                onChange={(e) => { setAuditSearch(e.target.value); setAuditPage(1); }}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-600"
              />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="success">Total Swaps Recorded: {auditPagination?.total || auditLogs.length}</Badge>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Swap Date &amp; Time</th>
                  <th className="p-3">Part ID</th>
                  <th className="p-3">Replaced Faulty Serial No</th>
                  <th className="p-3">New Spare Serial No</th>
                  <th className="p-3">State &amp; Location</th>
                  <th className="p-3">Building Name</th>
                  <th className="p-3">Room ID &amp; Name</th>
                  <th className="p-3">Dispatched By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {auditLoading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500 font-semibold">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                      Loading audit logs...
                    </td>
                  </tr>
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500 font-semibold">
                      No serial replacement swap records found.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-medium text-slate-700 whitespace-nowrap">
                        {new Date(log.swapDate || log.createdAt).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-900">{log.partId}</td>
                      <td className="p-3 font-mono font-bold text-rose-700">
                        <span className="bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-rose-800">
                          {log.oldFaultySerialNo}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-emerald-700">
                        <span className="bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-emerald-800">
                          {log.newSpareSerialNo}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-800">{log.state}</td>
                      <td className="p-3 text-slate-800 font-medium">{log.buildingName}</td>
                      <td className="p-3">
                        <p className="font-bold text-indigo-950">{log.roomId}</p>
                        {log.roomName && <p className="text-[11px] text-slate-500">{log.roomName}</p>}
                      </td>
                      <td className="p-3 font-bold text-slate-700">
                        {log.dispatchedByName || log.dispatchedBy?.name || 'System User'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {auditPagination && auditPagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 mt-2 bg-slate-50">
              <p className="text-xs text-slate-600 font-medium">
                Showing {((auditPage - 1) * 15) + 1}–{Math.min(auditPage * 15, auditPagination.total)} of {auditPagination.total} logs
              </p>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" disabled={auditPage <= 1} onClick={() => setAuditPage(p => p - 1)}>
                  Prev
                </Button>
                <span className="text-xs text-slate-800 font-bold px-2">{auditPage} / {auditPagination.totalPages}</span>
                <Button variant="secondary" size="sm" disabled={!auditPagination.hasNext} onClick={() => setAuditPage(p => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Location Inventory 15-Field Excel Upload Modal */}
      <Modal
        isOpen={locImportModalOpen}
        onClose={() => setLocImportModalOpen(false)}
        title="Upload 15-Field Location Inventory Excel"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-950">
            <p className="font-bold mb-1 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              15-Column Header Requirement:
            </p>
            <p className="text-[11px] font-mono text-indigo-800 leading-relaxed">
              Installation Date, OEM, Part ID, Part Serial No., Room ID, Location Class, Solution Type, Building Name, Room Name, Floor, Unit, Sub Unit, State, Contract Start Date, Contract End Date
            </p>
          </div>

          <div>
            <input
              type="file"
              ref={locFileInputRef}
              accept=".xlsx,.xls"
              onChange={handleLocFileImport}
              className="hidden"
            />
            <Button
              variant="primary"
              size="md"
              className="w-full justify-center"
              onClick={() => locFileInputRef.current?.click()}
              isLoading={isLocImporting}
              icon={<Upload className="w-4 h-4" />}
            >
              Select &amp; Upload 15-Field Excel File
            </Button>
          </div>

          {locImportSummary && (
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between text-xs font-bold p-3 bg-slate-100 rounded-xl">
                <span>Total Rows: {locImportSummary.totalRows || 0}</span>
                <span className="text-emerald-700">Imported: {locImportSummary.imported || 0}</span>
                <span className="text-indigo-700">Updated: {locImportSummary.updated || 0}</span>
                <span className="text-rose-700">Failed: {locImportSummary.failed || 0}</span>
              </div>

              {locImportSummary.errors && locImportSummary.errors.length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-2">
                  <p className="font-bold text-rose-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    Validation Errors &amp; Failures ({locImportSummary.errors.length}):
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-1 divide-y divide-rose-100 pr-1">
                    {locImportSummary.errors.map((err: any, idx: number) => (
                      <div key={idx} className="pt-1 text-[11px] text-rose-800 font-mono">
                        <strong className="text-rose-950 font-bold">Row {err.row}:</strong> {err.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* + New Serial No Registration Modal */}
      <Modal
        isOpen={newSerialModalOpen}
        onClose={() => setNewSerialModalOpen(false)}
        title="Register OEM Replacement (+ New Serial No)"
        maxWidth="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            newSerialMutation.mutate(newSerialForm);
          }}
          className="space-y-4"
        >
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

      {/* Dispatched / Reserved Site Location & SPOC Details Modal */}
      <Modal isOpen={!!locationModalItem} onClose={() => setLocationModalItem(null)} title="Reserved Site Location & SPOC Details" maxWidth="lg">
        {locationModalItem && (
          <div className="space-y-4">
            {/* Top Item Summary */}
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
                  Reserved BHEL Site Location &amp; SPOC Details
                </p>

                <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <p className="text-slate-500 text-[10px] font-semibold">Destination Site Name</p>
                    <p className="font-bold text-slate-900 mt-0.5">{locationDetails.siteName}</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <p className="text-slate-500 text-[10px] font-semibold">Site Location Class</p>
                    <p className="font-bold text-indigo-600 mt-0.5">Class {locationDetails.locationClass}</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <p className="text-slate-500 text-[10px] font-semibold">City &amp; State</p>
                    <p className="font-bold text-slate-900 mt-0.5">{locationDetails.city}, {locationDetails.state}</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <p className="text-slate-500 text-[10px] font-semibold">Dispatch / Reservation Date &amp; Time</p>
                    <p className="font-bold text-slate-900 mt-0.5">{locationDetails.dateTimeStr}</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 col-span-2">
                    <p className="text-slate-500 text-[10px] font-semibold">Site Address</p>
                    <p className="font-semibold text-slate-800 mt-0.5">{locationDetails.address}</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <p className="text-slate-500 text-[10px] font-semibold">Site SPOC Person</p>
                    <p className="font-bold text-slate-900 mt-0.5">{locationDetails.contactPerson}</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <p className="text-slate-500 text-[10px] font-semibold">SPOC Contact Phone</p>
                    <p className="font-bold text-slate-900 font-mono mt-0.5">{locationDetails.phone}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500 text-xs font-semibold">
                No location details logged for this item.
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <Button variant="secondary" size="sm" onClick={() => setLocationModalItem(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Replacement Serial Part Modal */}
      <Modal isOpen={!!replacementModalItem} onClose={() => setReplacementModalItem(null)} title="Add Replacement Serial Part" maxWidth="md">
        {replacementModalItem && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium">
              Item <span className="font-bold text-amber-900">{replacementModalItem.productName}</span> ({replacementModalItem.serialNumber || 'Bulk Unit'}) is currently {replacementModalItem.status}. Add a new replacement serial unit directly to Available Stock.
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                New Replacement Serial Number *
              </label>
              <input
                type="text"
                required
                value={replacementSerial}
                onChange={(e) => setReplacementSerial(e.target.value)}
                placeholder="e.g. SN-REPLACE-99882"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-mono font-bold focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Button variant="ghost" size="sm" onClick={() => setReplacementModalItem(null)}>
                Cancel
              </Button>
              <Button
                variant="success"
                size="sm"
                disabled={!replacementSerial.trim()}
                isLoading={createReplacementMutation.isPending}
                onClick={() => createReplacementMutation.mutate(replacementModalItem)}
              >
                Add to Stock
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Import Excel Modal */}
      <Modal isOpen={importModalOpen} onClose={() => setImportModalOpen(false)} title="Import Stock List Excel" maxWidth="md">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">Target Store Warehouse *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setImportStore('Delhi')}
                className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                  importStore === 'Delhi'
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                Delhi Store
              </button>
              <button
                type="button"
                onClick={() => setImportStore('Bengaluru')}
                className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                  importStore === 'Bengaluru'
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                Bengaluru Store
              </button>
            </div>
          </div>

          <div
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-600 transition-colors bg-slate-50"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-800">Click to select Excel file</p>
            <p className="text-xs text-slate-500 mt-1 font-medium">Supports .xlsx and .xls formats</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileImport}
          />

          {isImporting && (
            <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
              <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
              <span className="text-sm font-bold text-indigo-900">Importing stock data...</span>
            </div>
          )}

          {importSummary && !importSummary.error && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Import Complete
              </p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-white rounded-lg p-2 border border-slate-200">
                  <p className="text-slate-500 font-semibold">Total Rows</p>
                  <p className="font-bold text-slate-900">{importSummary.totalRows}</p>
                </div>
                <div className="bg-white rounded-lg p-2 border border-slate-200">
                  <p className="text-slate-500 font-semibold">Created</p>
                  <p className="font-bold text-emerald-600">{importSummary.created}</p>
                </div>
                <div className="bg-white rounded-lg p-2 border border-slate-200">
                  <p className="text-slate-500 font-semibold">Updated</p>
                  <p className="font-bold text-indigo-600">{importSummary.updated}</p>
                </div>
              </div>
            </div>
          )}

          {importSummary?.error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <p className="text-sm font-semibold text-rose-800">{importSummary.error}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button variant="secondary" size="sm" onClick={() => setImportModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* QR Code Preview Modal */}
      <Modal isOpen={!!qrModalItem} onClose={() => setQrModalItem(null)} title="Spare Part QR Code" maxWidth="sm">
        {qrModalItem && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="p-4 bg-white rounded-2xl shadow-md border border-slate-200">
              <img src={qrModalItem.qrCode} alt="QR Code" className="w-48 h-48 object-contain" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">{qrModalItem.productName}</p>
              <p className="text-xs text-indigo-600 font-mono font-bold mt-0.5">SN: {qrModalItem.serialNumber || 'N/A'}</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const link = document.createElement('a');
                link.href = qrModalItem.qrCode!;
                link.download = `QR_${qrModalItem.serialNumber || qrModalItem.partCode || 'Spare'}.png`;
                link.click();
              }}
            >
              Download QR Image
            </Button>
          </div>
        )}
      </Modal>

      {/* Add New Stock Item Modal */}
      <Modal isOpen={addItemModalOpen} onClose={() => setAddItemModalOpen(false)} title="Add New Stock Item" maxWidth="lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createItemMutation.mutate(newItemForm);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Product Name *</label>
              <input
                type="text"
                required
                value={newItemForm.productName}
                onChange={(e) => setNewItemForm({ ...newItemForm, productName: e.target.value })}
                placeholder="e.g. Cisco Catalyst 3850 Switch"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Part Code / SKU / Number</label>
              <input
                type="text"
                value={newItemForm.partCode}
                onChange={(e) => setNewItemForm({ ...newItemForm, partCode: e.target.value })}
                placeholder="e.g. WS-C3850-24P-S"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Store / Warehouse *</label>
              <select
                value={newItemForm.store}
                onChange={(e) => setNewItemForm({ ...newItemForm, store: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
              >
                <option value="Delhi">Delhi Main Store</option>
                <option value="Bengaluru">Bengaluru Regional Store</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Quantity *</label>
              <input
                type="number"
                min="1"
                required
                value={newItemForm.quantity}
                onChange={(e) => setNewItemForm({ ...newItemForm, quantity: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Serial Number</label>
              <input
                type="text"
                value={newItemForm.serialNumber}
                onChange={(e) => setNewItemForm({ ...newItemForm, serialNumber: e.target.value, isSerialized: Boolean(e.target.value.trim()) })}
                placeholder="e.g. FOC2145L09Z"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-mono font-bold focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Condition</label>
              <select
                value={newItemForm.condition}
                onChange={(e) => setNewItemForm({ ...newItemForm, condition: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
              >
                <option value="NEW">New</option>
                <option value="REFURBISHED">Refurbished</option>
                <option value="REPAIRED">Repaired</option>
                <option value="USED">Used</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Rack Location</label>
              <input
                type="text"
                value={newItemForm.rack}
                onChange={(e) => setNewItemForm({ ...newItemForm, rack: e.target.value })}
                placeholder="e.g. RACK-A4"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Bin Location</label>
              <input
                type="text"
                value={newItemForm.bin}
                onChange={(e) => setNewItemForm({ ...newItemForm, bin: e.target.value })}
                placeholder="e.g. BIN-02"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Warranty Start Date</label>
              <input
                type="date"
                value={newItemForm.warrantyStart}
                onChange={(e) => setNewItemForm({ ...newItemForm, warrantyStart: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Warranty End Date</label>
              <input
                type="date"
                value={newItemForm.warrantyEnd}
                onChange={(e) => setNewItemForm({ ...newItemForm, warrantyEnd: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">Remarks</label>
            <textarea
              rows={2}
              value={newItemForm.remarks}
              onChange={(e) => setNewItemForm({ ...newItemForm, remarks: e.target.value })}
              placeholder="Additional specifications or spare part remarks..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:border-indigo-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button variant="ghost" size="sm" type="button" onClick={() => setAddItemModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              isLoading={createItemMutation.isPending}
              disabled={!newItemForm.productName.trim()}
            >
              Save Spare Part
            </Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
};
