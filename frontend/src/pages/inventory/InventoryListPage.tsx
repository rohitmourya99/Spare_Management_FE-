import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Upload, ChevronLeft, ChevronRight, X, AlertTriangle, CheckCircle2,
  RefreshCw, Building2, MapPin, Calendar, Layers, ShieldCheck, History, ArrowRightLeft,
  FileSpreadsheet, Filter, Check, Clock, Tag, Download, Plus
} from 'lucide-react';
import api from '../../api';
import { useOrganization } from '../../context/OrganizationContext';
import { Layout } from '../../components/layout';
import { Button, Card, Badge, Modal } from '../../components/ui';
import { isRealSerial, formatSerialDisplay } from '../../utils/serialUtils';

interface LocationInventoryItem {
  id: string;
  installationDate?: string;
  oem: string;
  partId: string;
  partSerialNo: string;
  roomId: string;
  locationClass: string;
  solutionType: string;
  buildingName: string;
  roomName: string;
  floor: string;
  unit: string;
  subUnit: string;
  state: string;
  contractStartDate?: string;
  contractEndDate?: string;
  createdAt: string;
}

interface ReplacementAuditLog {
  id: string;
  roomId: string;
  roomName?: string;
  partId: string;
  buildingName?: string;
  floor?: string;
  oldSerialNo?: string;
  oldFaultySerialNo?: string;
  newSerialNo?: string;
  newSpareSerialNo?: string;
  swappedBy?: string;
  dispatchedByName?: string;
  swapReason?: string;
  swappedAt?: string;
  swapDate?: string;
  state?: string;
}

export const InventoryListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { selectedOrg } = useOrganization();
  const [activeTab, setActiveTab] = useState<'location-inventory' | 'audit-history'>('location-inventory');

  // Search & Filter state for Location Inventory
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterSublocation, setFilterSublocation] = useState('');
  const [filterBuilding, setFilterBuilding] = useState('');
  const [filterRoomId, setFilterRoomId] = useState('');
  const [page, setPage] = useState(1);

  // Search state for Replacement Audit Log
  const [auditSearch, setAuditSearch] = useState('');
  const [auditPage, setAuditPage] = useState(1);

  // Modal for 15-Field Excel Upload
  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSummary, setUploadSummary] = useState<any>(null);
  const excelFileInputRef = useRef<HTMLInputElement>(null);

  // Modal for Manual Swap History Logging
  const [logSwapModalOpen, setLogSwapModalOpen] = useState(false);
  const [logSwapForm, setLogSwapForm] = useState({
    roomId: '',
    roomName: '',
    partId: '',
    buildingName: '',
    floor: '',
    oldSerialNo: '',
    newSerialNo: '',
    swappedBy: '',
    swapReason: 'Stock Replacement',
  });

  // Location Hierarchy Query
  const { data: hierarchyData } = useQuery({
    queryKey: ['location-hierarchy', selectedOrg],
    queryFn: async () => {
      const res = await api.get('/inventory/location-hierarchy');
      return res.data.data;
    },
    enabled: activeTab === 'location-inventory',
  });

  const hierarchyItems: any[] = hierarchyData?.items || [];
  const sublocationOptions: string[] = hierarchyData?.sublocations?.length
    ? hierarchyData.sublocations
    : Array.from(new Set(hierarchyItems.map(i => i.subUnit).filter(Boolean)));

  const availableBuildings: string[] = Array.from(
    new Set(
      hierarchyItems
        .filter(i => !filterSublocation || i.subUnit === filterSublocation || i.unit === filterSublocation)
        .map(i => i.buildingName)
        .filter(Boolean)
    )
  );

  const availableRooms = hierarchyItems
    .filter(i => (!filterSublocation || i.subUnit === filterSublocation || i.unit === filterSublocation) && (!filterBuilding || i.buildingName === filterBuilding))
    .map(i => ({ roomId: i.roomId, roomName: i.roomName }))
    .filter((v, idx, self) => v.roomId && self.findIndex(t => t.roomId === v.roomId) === idx);

  // Query Location Inventory
  const locationParams: any = { search, page, limit: 15 };
  if (filterState) locationParams.state = filterState;
  if (filterSublocation) locationParams.sublocation = filterSublocation;
  if (filterBuilding) locationParams.buildingName = filterBuilding;
  if (filterRoomId) locationParams.roomId = filterRoomId;

  const { data: locationData, isLoading: locationLoading } = useQuery({
    queryKey: ['location-inventory', locationParams, selectedOrg],
    queryFn: async () => {
      const res = await api.get('/inventory/location-inventory', { params: locationParams });
      return res.data;
    },
    enabled: activeTab === 'location-inventory',
  });

  const installedItems: LocationInventoryItem[] = locationData?.data || [];
  const locationPagination = locationData?.pagination;

  // Query Swap History Records
  const auditParams: any = { search: auditSearch, page: auditPage, limit: 15 };

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['swap-history', auditParams],
    queryFn: async () => {
      const res = await api.get('/swap-history', { params: auditParams });
      return res.data;
    },
    enabled: activeTab === 'audit-history',
  });

  const auditLogs: ReplacementAuditLog[] = auditData?.items || auditData?.data || [];
  const auditPagination = auditData?.pagination;

  // Manual Swap Mutation
  const createSwapMutation = useMutation({
    mutationFn: async (payload: typeof logSwapForm) => {
      const res = await api.post('/swap-history', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['swap-history'] });
      setLogSwapModalOpen(false);
      setLogSwapForm({
        roomId: '',
        roomName: '',
        partId: '',
        buildingName: '',
        floor: '',
        oldSerialNo: '',
        newSerialNo: '',
        swappedBy: '',
        swapReason: 'Stock Replacement',
      });
    },
  });

  // Handle Export Swap History Excel
  const handleExportSwapExcel = async () => {
    try {
      const res = await api.get('/swap-history/export', {
        params: { search: auditSearch },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Swap_Tracking_Audit_History_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error('Export error:', e);
    }
  };

  // Handle 15-Field Excel File Upload
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Case-insensitive file extension check to prevent 400 Bad Request from wrong file types
    const allowedExtRegex = /\.(xlsx|xls|csv)$/i;
    if (!allowedExtRegex.test(file.name)) {
      setUploadSummary({
        success: false,
        message: 'Invalid file type. Please upload a .xlsx, .xls, or .csv file.',
        errors: [],
      });
      if (excelFileInputRef.current) excelFileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadSummary(null);

    const formData = new FormData();
    formData.append('file', file);

    // DO NOT set 'Content-Type': 'multipart/form-data' manually — browser auto-generates boundary string
    try {
      const res = await api.post('/inventory/upload-location-excel', formData, {
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total && progressEvent.total > 0) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          } else {
            setUploadProgress(50);
          }
        },
      });
      setUploadSummary(res.data);
      queryClient.invalidateQueries({ queryKey: ['location-inventory'] });
    } catch (err: any) {
      setUploadSummary({
        success: false,
        message: err.response?.data?.message || 'Failed to parse Excel file',
        errors: err.response?.data?.errors || [],
      });
    } finally {
      setIsUploading(false);
      if (excelFileInputRef.current) excelFileInputRef.current.value = '';
    }
  };

  return (
    <Layout title="Location Inventory & Swap Tracking">
      {/* 2 Internal Tab Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 p-1 bg-slate-100 border border-slate-200 rounded-2xl">
          <button
            onClick={() => setActiveTab('location-inventory')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'location-inventory'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
          >
            <Building2 className="w-4 h-4" />
            Location Inventory (15-Field Spec)
          </button>
          <button
            onClick={() => setActiveTab('audit-history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'audit-history'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
          >
            <History className="w-4 h-4" />
            Swap Tracking / Audit History
          </button>
        </div>

        {/* Tab Header Action Buttons */}
        {activeTab === 'location-inventory' && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="primary"
              size="sm"
              onClick={() => { setUploadSummary(null); setExcelModalOpen(true); }}
              icon={<Upload className="w-4 h-4" />}
            >
              Upload 15-Field Inventory Excel
            </Button>
          </div>
        )}
        {activeTab === 'audit-history' && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportSwapExcel}
              icon={<Download className="w-4 h-4 text-emerald-600" />}
            >
              Export Swap Excel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setLogSwapModalOpen(true)}
              icon={<Plus className="w-4 h-4" />}
            >
              Record Device Swap
            </Button>
          </div>
        )}
      </div>

      {/* ============================== TAB 1: LOCATION INVENTORY (15-FIELD SPEC) ============================== */}
      {activeTab === 'location-inventory' && (
        <>
          {/* Structured Hierarchical Folder-Wise Navigation Filter Bar (BHEL Only vs Clean Header Bar for Non-BHEL) */}
          {selectedOrg === 'BHEL' ? (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl mb-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Folder-Wise Location Hierarchy Navigation
                </p>
                {(filterSublocation || filterBuilding || filterRoomId || filterState || search) && (
                  <button
                    onClick={() => {
                      setFilterSublocation('');
                      setFilterBuilding('');
                      setFilterRoomId('');
                      setFilterState('');
                      setSearch('');
                      setPage(1);
                    }}
                    className="text-xs text-rose-600 font-bold hover:underline flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> Clear Hierarchy Filters
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {/* Sublocation Dropdown */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">1. Sublocation / Unit</label>
                  <select
                    value={filterSublocation}
                    onChange={(e) => {
                      setFilterSublocation(e.target.value);
                      setFilterBuilding('');
                      setFilterRoomId('');
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600 cursor-pointer"
                  >
                    <option value="">📁 All Sublocations...</option>
                    {sublocationOptions.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>

                {/* Building Name Dropdown */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">2. Building Name</label>
                  <select
                    value={filterBuilding}
                    onChange={(e) => {
                      setFilterBuilding(e.target.value);
                      setFilterRoomId('');
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600 cursor-pointer"
                  >
                    <option value="">🏢 All Buildings...</option>
                    {availableBuildings.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                {/* Room Name / Room ID List */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">3. Room Name / Room ID</label>
                  <select
                    value={filterRoomId}
                    onChange={(e) => {
                      setFilterRoomId(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-indigo-700 focus:outline-none focus:border-indigo-600 cursor-pointer"
                  >
                    <option value="">🚪 All Rooms / Room IDs...</option>
                    {availableRooms.map(rm => (
                      <option key={rm.roomId} value={rm.roomId}>
                        {rm.roomId} {rm.roomName ? `(${rm.roomName})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search Bar */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Search Serial / Part ID</label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search Serial, Part ID..."
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
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl mb-5">
              <div>
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  Client Location Inventory Directory
                </p>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  View and manage uploaded installed location inventory items for active client organization.
                </p>
              </div>
              <div className="relative min-w-[280px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search Serial, Part ID..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 font-medium shadow-xs"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 15-Field Location Inventory Table */}
          <Card noPadding>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs whitespace-nowrap data-table">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-3">S.No</th>
                    <th className="p-3">Installation Date</th>
                    <th className="p-3">OEM</th>
                    <th className="p-3">Part ID</th>
                    <th className="p-3">Part Serial No.</th>
                    <th className="p-3">Room ID</th>
                    <th className="p-3">Location Class</th>
                    <th className="p-3">Solution Type</th>
                    <th className="p-3">Building Name</th>
                    <th className="p-3">Room Name</th>
                    <th className="p-3">Floor</th>
                    <th className="p-3">Unit</th>
                    <th className="p-3">Sub Unit</th>
                    <th className="p-3">State</th>
                    <th className="p-3">Contract Start Date</th>
                    <th className="p-3">Contract End Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-900">
                  {locationLoading ? (
                    <tr>
                      <td colSpan={16} className="p-8 text-center text-slate-500 font-semibold">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                        Loading 15-field location inventory...
                      </td>
                    </tr>
                  ) : installedItems.length === 0 ? (
                    <tr>
                      <td colSpan={16} className="p-8 text-center text-slate-500 font-semibold">
                        <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                        No location inventory records found. Click "Upload 15-Field Inventory Excel" to import.
                      </td>
                    </tr>
                  ) : (
                    installedItems.map((item, index) => {
                      const sequenceNo = ((page - 1) * 15) + index + 1;
                      const serialDisplay = formatSerialDisplay(item.partSerialNo, '');
                      const formatDate = (d: string | null | undefined) =>
                        d ? new Date(d).toLocaleDateString('en-IN') : null;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-mono font-bold text-slate-700 text-center">{sequenceNo}</td>
                          <td className="p-3 text-slate-700 font-medium">
                            {formatDate(item.installationDate) ?? <span className="italic text-slate-400 font-normal text-[11px]">Not Set</span>}
                          </td>
                          <td className="p-3 font-bold text-slate-900">{item.oem}</td>
                          <td className="p-3 font-mono font-bold text-indigo-600">{item.partId}</td>
                          <td className="p-3 font-mono">
                            {serialDisplay ? (
                              <span className="px-2 py-0.5 rounded font-bold border text-xs bg-emerald-50 text-emerald-800 border-emerald-200">
                                {serialDisplay}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal italic">-</span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-slate-800 font-bold">{item.roomId}</td>
                          <td className="p-3 text-slate-700 font-medium">{item.locationClass}</td>
                          <td className="p-3 text-slate-700 font-medium">{item.solutionType}</td>
                          <td className="p-3 font-bold text-slate-900">{item.buildingName}</td>
                          <td className="p-3 text-slate-800 font-semibold">{item.roomName}</td>
                          <td className="p-3 text-slate-700">{item.floor}</td>
                          <td className="p-3 text-slate-700">{item.unit}</td>
                          <td className="p-3 text-slate-700">{item.subUnit}</td>
                          <td className="p-3 font-bold text-slate-900">
                            <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200 font-bold">
                              {item.state}
                            </span>
                          </td>
                          <td className="p-3 text-slate-700">
                            {formatDate(item.contractStartDate) ?? <span className="italic text-slate-400 font-normal text-[11px]">Not Set</span>}
                          </td>
                          <td className="p-3 text-slate-700">
                            {formatDate(item.contractEndDate) ?? <span className="italic text-slate-400 font-normal text-[11px]">Not Set</span>}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Location Inventory Pagination */}
            {locationPagination && locationPagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
                <p className="text-xs text-slate-600 font-medium">
                  Showing {((page - 1) * 15) + 1}–{Math.min(page * 15, locationPagination.total)} of {locationPagination.total} items
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} icon={<ChevronLeft className="w-3.5 h-3.5" />}>
                    Prev
                  </Button>
                  <span className="text-xs text-slate-800 font-bold px-2">{page} / {locationPagination.totalPages}</span>
                  <Button variant="secondary" size="sm" disabled={!locationPagination.hasNext} onClick={() => setPage(p => p + 1)}>
                    Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ============================== TAB 2: SWAP TRACKING / AUDIT HISTORY ============================== */}
      {activeTab === 'audit-history' && (
        <>
          {/* Audit Search Bar */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-2xl mb-5">
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search Faulty Serial, Spare Serial, Part ID, Building, User..."
                value={auditSearch}
                onChange={(e) => { setAuditSearch(e.target.value); setAuditPage(1); }}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 font-medium"
              />
              {auditSearch && (
                <button onClick={() => setAuditSearch('')} className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 font-bold">
              Showing replacement audit records &amp; serial swaps log
            </p>
          </div>

          {/* Audit Logs Table */}
          <Card noPadding>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs whitespace-nowrap data-table">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-3.5">Swap Date &amp; Time</th>
                    <th className="p-3.5">Room ID / Room Name</th>
                    <th className="p-3.5">Building &amp; Floor</th>
                    <th className="p-3.5">Part ID</th>
                    <th className="p-3.5">Old Faulty Serial No</th>
                    <th className="p-3.5">New Spare Serial No</th>
                    <th className="p-3.5">Swapped By</th>
                    <th className="p-3.5">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-900">
                  {auditLoading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500 font-semibold">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                        Loading swap tracking audit logs...
                      </td>
                    </tr>
                  ) : auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500 font-semibold">
                        <History className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                        No serial replacement audit history logs recorded yet.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => {
                      const oldSerial = formatSerialDisplay(log.oldSerialNo || log.oldFaultySerialNo, '');
                      const newSerial = formatSerialDisplay(log.newSerialNo || log.newSpareSerialNo, '');
                      const swapTime = log.swappedAt || log.swapDate;
                      return (
                        <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3.5 text-slate-700 font-semibold">
                            {swapTime ? new Date(swapTime).toLocaleString('en-IN') : '—'}
                          </td>
                          <td className="p-3.5 text-slate-800">
                            <p className="font-bold text-indigo-600">{log.roomId}</p>
                            {log.roomName && <p className="text-xs text-slate-500 font-medium">{log.roomName}</p>}
                          </td>
                          <td className="p-3.5 font-bold text-slate-900">
                            <p>{log.buildingName || '—'}</p>
                            {log.floor && <p className="text-xs text-slate-500 font-normal">Floor {log.floor}</p>}
                          </td>
                          <td className="p-3.5 font-mono font-bold text-slate-900">{log.partId}</td>
                          <td className="p-3.5 font-mono">
                            {oldSerial ? (
                              <span className="bg-rose-50 text-rose-800 border border-rose-200 px-2.5 py-0.5 rounded font-bold">
                                {oldSerial}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal italic">-</span>
                            )}
                          </td>
                          <td className="p-3.5 font-mono">
                            {newSerial ? (
                              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded font-bold">
                                {newSerial}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal italic">-</span>
                            )}
                          </td>
                          <td className="p-3.5 font-bold text-slate-900">
                            {log.swappedBy || log.dispatchedByName || 'Technician'}
                          </td>
                          <td className="p-3.5 text-slate-700 font-medium">
                            <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200 font-medium text-[11px]">
                              {log.swapReason || log.state || 'Stock Replacement'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Audit Logs Pagination */}
            {auditPagination && auditPagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
                <p className="text-xs text-slate-600 font-medium">
                  Showing {((auditPage - 1) * 15) + 1}–{Math.min(auditPage * 15, auditPagination.total)} of {auditPagination.total} audit logs
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" disabled={auditPage <= 1} onClick={() => setAuditPage(p => p - 1)} icon={<ChevronLeft className="w-3.5 h-3.5" />}>
                    Prev
                  </Button>
                  <span className="text-xs text-slate-800 font-bold px-2">{auditPage} / {auditPagination.totalPages}</span>
                  <Button variant="secondary" size="sm" disabled={!auditPagination.hasNext} onClick={() => setAuditPage(p => p + 1)}>
                    Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {/* 15-Field Location Inventory Excel Upload Modal */}
      <Modal isOpen={excelModalOpen} onClose={() => setExcelModalOpen(false)} title="Upload 15-Field Location Inventory Excel" maxWidth="lg">
        <div className="space-y-4">
          <p className="text-xs text-slate-600 font-medium">
            Upload an Excel/CSV file matching the exact 15 specification columns: <br />
            <span className="font-mono text-[11px] text-slate-800 font-bold">
              Installation Date, OEM, Part ID, Part Serial No., Room ID, Location Class, Solution Type, Building Name, Room Name, Floor, Unit, Sub Unit, State, Contract Start Date, Contract End Date
            </span>
          </p>

          <div>
            <input type="file" ref={excelFileInputRef} accept=".xlsx,.xls,.csv,.XLSX,.XLS,.CSV,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={handleExcelUpload} className="hidden" />
            <Button
              variant="primary"
              size="md"
              className="w-full justify-center"
              onClick={() => excelFileInputRef.current?.click()}
              isLoading={isUploading}
              icon={<Upload className="w-4 h-4" />}
            >
              Select 15-Field Excel File
            </Button>
          </div>

          {isUploading && (
            <div className="mt-3 w-full space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <span>Uploading Inventory...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-200 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {uploadSummary && (
            <div className={`p-4 rounded-xl text-xs space-y-3 border ${uploadSummary.success ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
              <p className="font-bold text-sm flex items-center gap-1.5">
                {uploadSummary.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
                {uploadSummary.message}
              </p>
              {uploadSummary.data && (
                <div className="grid grid-cols-2 gap-2 text-xs font-semibold p-3 bg-white rounded-xl border border-slate-200">
                  <div><span className="text-slate-500">Total File Rows:</span> <span className="font-mono font-bold text-slate-900">{uploadSummary.data.totalRows}</span></div>
                  <div><span className="text-slate-500">Valid Processed:</span> <span className="font-mono font-bold text-indigo-600">{uploadSummary.data.validRows ?? uploadSummary.data.totalRows}</span></div>
                  <div><span className="text-slate-500">New Inserted:</span> <span className="font-mono font-bold text-emerald-600">{uploadSummary.data.imported}</span></div>
                  <div><span className="text-slate-500">Updated:</span> <span className="font-mono font-bold text-blue-600">{uploadSummary.data.updated}</span></div>
                  <div><span className="text-slate-500">Skipped (Unchanged):</span> <span className="font-mono font-bold text-slate-600">{uploadSummary.data.skipped}</span></div>
                  <div><span className="text-slate-500">Failed Records:</span> <span className="font-mono font-bold text-rose-600">{uploadSummary.data.failed}</span></div>
                </div>
              )}
              {uploadSummary.data?.failedDetails && uploadSummary.data.failedDetails.length > 0 && (
                <div className="mt-2 pt-2 border-t border-rose-200 space-y-1">
                  <p className="font-bold text-rose-800">Failed Records Log:</p>
                  <div className="max-h-32 overflow-y-auto bg-rose-100 p-2 rounded-lg text-[11px] font-mono space-y-0.5">
                    {uploadSummary.data.failedDetails.map((f: any, idx: number) => (
                      <p key={idx} className="text-rose-900">• {f.reason || f}</p>
                    ))}
                  </div>
                </div>
              )}
              {uploadSummary.errors && uploadSummary.errors.length > 0 && (
                <div className="mt-2 pt-2 border-t border-rose-200 space-y-1">
                  <p className="font-bold text-rose-800">Validation Failures:</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] font-mono">
                    {uploadSummary.errors.map((errStr: string, idx: number) => (
                      <li key={idx}>{errStr}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Record Device Swap Modal */}
      <Modal isOpen={logSwapModalOpen} onClose={() => setLogSwapModalOpen(false)} title="Record Device Swap & Audit History" maxWidth="md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createSwapMutation.mutate(logSwapForm);
          }}
          className="space-y-4 text-xs"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Room ID *</label>
              <input
                type="text"
                required
                placeholder="e.g. RM-101"
                value={logSwapForm.roomId}
                onChange={(e) => setLogSwapForm({ ...logSwapForm, roomId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 font-semibold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Room Name</label>
              <input
                type="text"
                placeholder="e.g. Conference Room A"
                value={logSwapForm.roomName}
                onChange={(e) => setLogSwapForm({ ...logSwapForm, roomName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Part ID *</label>
              <input
                type="text"
                required
                placeholder="e.g. PART-8890"
                value={logSwapForm.partId}
                onChange={(e) => setLogSwapForm({ ...logSwapForm, partId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 font-semibold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Building Name</label>
              <input
                type="text"
                placeholder="e.g. Building 4"
                value={logSwapForm.buildingName}
                onChange={(e) => setLogSwapForm({ ...logSwapForm, buildingName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Old Faulty Serial No *</label>
              <input
                type="text"
                required
                placeholder="Old Serial Number"
                value={logSwapForm.oldSerialNo}
                onChange={(e) => setLogSwapForm({ ...logSwapForm, oldSerialNo: e.target.value })}
                className="w-full px-3 py-2 border border-rose-300 rounded-xl text-rose-900 font-mono font-bold focus:outline-none focus:border-rose-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">New Spare Serial No *</label>
              <input
                type="text"
                required
                placeholder="New Serial Number"
                value={logSwapForm.newSerialNo}
                onChange={(e) => setLogSwapForm({ ...logSwapForm, newSerialNo: e.target.value })}
                className="w-full px-3 py-2 border border-emerald-300 rounded-xl text-emerald-900 font-mono font-bold focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Swapped By</label>
              <input
                type="text"
                placeholder="Technician / User Name"
                value={logSwapForm.swappedBy}
                onChange={(e) => setLogSwapForm({ ...logSwapForm, swappedBy: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Swap Reason</label>
              <input
                type="text"
                placeholder="e.g. Stock Replacement"
                value={logSwapForm.swapReason}
                onChange={(e) => setLogSwapForm({ ...logSwapForm, swapReason: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button variant="ghost" size="sm" type="button" onClick={() => setLogSwapModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={createSwapMutation.isPending}>
              Save Swap Audit Entry
            </Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
};
