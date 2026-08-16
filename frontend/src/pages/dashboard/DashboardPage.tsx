import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import {
  Package, Layers, MapPin, Cpu, AlertTriangle,
  Truck, RotateCcw, Upload, Search, FileSpreadsheet, ChevronRight,
  Activity, Archive, CheckCircle2, XCircle, Sparkles, TrendingUp, Filter,
  ShieldAlert, Clock, History, UserCheck, ArrowRight
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import api from '../../api';
import { Layout } from '../../components/layout';
import { Card, Badge, StatCard } from '../../components/ui';

import { useOrganization } from '../../context/OrganizationContext';

const COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0891b2', '#65a30d', '#ea580c'];

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedOrg, organizations } = useOrganization();
  const [activeCardFilter, setActiveCardFilter] = useState<string>('TOTAL_SPARE_PARTS');
  const [selectedStore, setSelectedStore] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isStockModalOpen, setIsStockModalOpen] = useState<boolean>(false);
  const tableSectionRef = useRef<HTMLDivElement>(null);

  const activeOrgObj = useMemo(() => {
    return organizations.find((o) => o.id === selectedOrg) || { id: 'BHEL', name: 'BHEL' };
  }, [organizations, selectedOrg]);

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses', selectedOrg],
    queryFn: async () => {
      const res = await api.get('/warehouses', { params: { organizationId: selectedOrg } });
      return res.data?.data || [];
    },
  });

  const warehouses = useMemo(() => {
    if (selectedOrg === 'BHEL') {
      return [
        { id: 'delhi', name: 'Delhi Store', code: 'DELHI', storeKey: 'DELHI' },
        { id: 'bengaluru', name: 'Bengaluru Store', code: 'BENGALURU', storeKey: 'BENGALURU' },
      ];
    }
    if (warehousesData && Array.isArray(warehousesData) && warehousesData.length > 0) {
      return warehousesData;
    }
    return [
      { id: 'primary', name: `${activeOrgObj.name} Store`, code: selectedOrg, storeKey: 'PRIMARY' },
    ];
  }, [selectedOrg, activeOrgObj.name, warehousesData]);

  useEffect(() => {
    if (selectedOrg !== 'BHEL' && (selectedStore === 'DELHI' || selectedStore === 'BENGALURU')) {
      setSelectedStore('ALL');
    }
  }, [selectedOrg, selectedStore]);

  const handleCardClick = (cardId: string) => {
    setActiveCardFilter(cardId);
    if (cardId === 'DELHI_STORE') {
      setSelectedStore('DELHI');
    } else if (cardId === 'BENGALURU_STORE') {
      setSelectedStore('BENGALURU');
    } else if (cardId === 'PRIMARY_STORE') {
      setSelectedStore('PRIMARY');
    }
  };

  const handleReviewStock = () => {
    setActiveCardFilter('LOW_STOCK');
    setSearchQuery('');
    setTimeout(() => {
      tableSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-stats', selectedOrg],
    queryFn: async () => {
      const res = await api.get('/inventory/dashboard-stats');
      return res.data.data;
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    staleTime: 0,
    retry: false,
  });

  const inv = data?.inventorySummary || {};
  const delhi = data?.delhiStoreSummary || {};
  const blr = data?.bengaluruStoreSummary || {};

  const warehouseCards = useMemo(() => {
    if (selectedOrg === 'BHEL') {
      return [
        { id: 'DELHI_STORE', title: 'Delhi Store Stock', value: inv.delhiTotalStock ?? 0, icon: MapPin, color: 'text-emerald-600' },
        { id: 'BENGALURU_STORE', title: 'Bengaluru Stock', value: inv.bengaluruTotalStock ?? 0, icon: MapPin, color: 'text-orange-600' },
      ];
    } else {
      const primaryWarehouseName = warehouses[0]?.name || `${activeOrgObj.name} Store`;
      return [
        { id: 'PRIMARY_STORE', title: `${primaryWarehouseName} Stock`, value: inv.totalSpareParts ?? 0, icon: MapPin, color: 'text-emerald-600' },
      ];
    }
  }, [selectedOrg, activeOrgObj.name, inv, warehouses]);

  const { data: dynamicLowStock, isLoading: isLoadingDynamic, refetch: refetchDynamicLowStock } = useQuery({
    queryKey: ['dynamic-low-stock'],
    queryFn: async () => {
      const res = await api.get('/stock/low-stock-details');
      return res.data;
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const handleOpenStockModal = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    refetchDynamicLowStock();
    setIsStockModalOpen(true);
  };

  const { data: inventoryItemsData, isLoading: isLoadingInventory } = useQuery({
    queryKey: ['dashboard-inventory-items', selectedOrg],
    queryFn: async () => {
      const res = await api.get('/inventory?limit=500');
      return Array.isArray(res.data?.data) ? res.data.data : (res.data?.data?.items || []);
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const { data: dispatchesQueryData } = useQuery({
    queryKey: ['dashboard-dispatches-list', selectedOrg],
    queryFn: async () => {
      try {
        const res = await api.get('/dispatch?limit=100');
        return Array.isArray(res.data?.data) ? res.data.data : (res.data?.data?.items || []);
      } catch (e) {
        return [];
      }
    },
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  const { data: pickupsQueryData } = useQuery({
    queryKey: ['dashboard-pickups-list', selectedOrg],
    queryFn: async () => {
      try {
        const res = await api.get('/pickup?limit=100');
        return Array.isArray(res.data?.data) ? res.data.data : (res.data?.data?.items || []);
      } catch (e) {
        return [];
      }
    },
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  // Robust inventory classification & stock calculation helpers
  const isItemSerialized = (i: any) =>
    i.isSerialized === true ||
    i.is_serialized === true ||
    i.isSerialized === 'true' ||
    i.is_serialized === 'true' ||
    i.isSerialized === 1 ||
    i.is_serialized === 1 ||
    i.type === 'SERIALIZED' ||
    Boolean(i.serialNumber && i.serialNumber !== 'N/A' && i.serialNumber !== '-');

  const getAvailableQty = (i: any): number => {
    if (i.availableQuantity !== undefined && i.availableQuantity !== null) {
      return Math.max(0, Number(i.availableQuantity));
    }
    if (i.status === 'RESERVED' || i.status === 'DISPATCHED') {
      return 0;
    }
    return Math.max(0, Number(i.quantity ?? i.currentQuantity ?? 0));
  };

  const getReservedQty = (i: any): number => {
    if (i.reservedQuantity !== undefined && i.reservedQuantity !== null) {
      return Math.max(0, Number(i.reservedQuantity));
    }
    const total = Number(i.quantity ?? i.totalQuantity ?? i.initialQuantity ?? 0);
    const avail = getAvailableQty(i);
    if (total > avail) {
      return total - avail;
    }
    if (i.status === 'RESERVED' || i.status === 'IN_TRANSIT') {
      return Math.max(1, total || 1);
    }
    return 0;
  };

  const getTotalQty = (i: any): number => {
    const avail = getAvailableQty(i);
    const res = getReservedQty(i);
    return Math.max(avail + res, Number(i.quantity ?? i.totalQuantity ?? 0));
  };

  const getInitialCapacity = (i: any) => getTotalQty(i);

  const getStoreName = (i: any) =>
    (i.store || i.storeLocation || i.locationName || i.location?.name || i.location || i.warehouse || i.store_location || '')
      .toString()
      .toLowerCase();

  // Real-time Stock List 50% Threshold Analysis & Banner Sync
  const stockMetrics = useMemo(() => {
    if (!inventoryItemsData || !Array.isArray(inventoryItemsData)) {
      const low = inv.lowStockCount ?? 0;
      const out = inv.outOfStockCount ?? 0;
      return {
        lowStockCount: low,
        outOfStockCount: out,
        affectedTypesCount: low + out,
        lowStockItems: data?.lowStockAlerts || [],
      };
    }

    const groups = new Map<string, {
      partCode: string;
      productName: string;
      oemName: string;
      totalQuantity: number;
      availableQuantity: number;
      sampleItem: any;
    }>();

    for (const item of inventoryItemsData) {
      const key = (item.partCode || item.productName || item.spareId || 'UNKNOWN').trim();
      const existing = groups.get(key);
      const total = getTotalQty(item);
      const avail = getAvailableQty(item);

      if (!existing) {
        groups.set(key, {
          partCode: key,
          productName: item.productName || key,
          oemName: item.oem?.name || 'Standard OEM',
          totalQuantity: total,
          availableQuantity: avail,
          sampleItem: item,
        });
      } else {
        existing.totalQuantity += total;
        existing.availableQuantity += avail;
      }
    }

    let lowStockCount = 0;
    let outOfStockCount = 0;
    const lowStockItems: any[] = [];

    for (const g of groups.values()) {
      const isOut = g.availableQuantity === 0;
      const isLow = g.availableQuantity > 0 && g.availableQuantity <= (g.totalQuantity * 0.5);

      if (isOut) {
        outOfStockCount++;
        lowStockItems.push({
          ...g.sampleItem,
          partCode: g.partCode,
          productName: g.productName,
          oemName: g.oemName,
          totalQuantity: g.totalQuantity,
          availableQuantity: g.availableQuantity,
          percentRemaining: 0,
          isOutOfStock: true,
        });
      } else if (isLow) {
        lowStockCount++;
        const percent = Math.round((g.availableQuantity / g.totalQuantity) * 100);
        lowStockItems.push({
          ...g.sampleItem,
          partCode: g.partCode,
          productName: g.productName,
          oemName: g.oemName,
          totalQuantity: g.totalQuantity,
          availableQuantity: g.availableQuantity,
          percentRemaining: percent,
          isOutOfStock: false,
        });
      }
    }

    const affectedTypesCount = lowStockCount + outOfStockCount;

    return {
      lowStockCount,
      outOfStockCount,
      affectedTypesCount,
      lowStockItems,
    };
  }, [inventoryItemsData, inv, data?.lowStockAlerts]);

  // Filter Stock items based on active card filter, selected store & search input
  const filteredInventoryItems = useMemo(() => {
    if (!inventoryItemsData || !Array.isArray(inventoryItemsData)) return [];
    let items = [...inventoryItemsData];

    if (selectedStore === 'DELHI') {
      items = items.filter((i: any) => getStoreName(i).includes('delhi'));
    } else if (selectedStore === 'BENGALURU') {
      items = items.filter((i: any) => getStoreName(i).includes('bengaluru') || getStoreName(i).includes('blr'));
    }

    if (['TOTAL_SPARE_PARTS', 'SERIALIZED_PARTS', 'NON_SERIALIZED', 'DELHI_STORE', 'BENGALURU_STORE', 'PRIMARY_STORE'].includes(activeCardFilter)) {
      items = items.filter((i: any) => i.status !== 'DISPATCHED' && i.status !== 'REMOVED' && i.status !== 'CONSUMED');
    }

    switch (activeCardFilter) {
      case 'SERIALIZED_PARTS':
        items = items.filter((i: any) => isItemSerialized(i));
        break;
      case 'NON_SERIALIZED':
        items = items.filter((i: any) => !isItemSerialized(i));
        break;
      case 'DELHI_STORE':
        items = items.filter((i: any) => getStoreName(i).includes('delhi'));
        break;
      case 'BENGALURU_STORE':
        items = items.filter((i: any) => getStoreName(i).includes('bengaluru') || getStoreName(i).includes('blr'));
        break;
      case 'LOW_STOCK':
        items = items.filter((i: any) => getAvailableQty(i) <= (getTotalQty(i) * 0.5) && getAvailableQty(i) > 0);
        break;
      case 'OUT_OF_STOCK':
        items = items.filter((i: any) => getAvailableQty(i) === 0);
        break;
      case 'TOTAL_OEM':
        items.sort((a: any, b: any) => (a.oem?.name || '').localeCompare(b.oem?.name || ''));
        break;
      case 'TOTAL_SPARE_PARTS':
      default:
        break;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (i: any) =>
          i.productName?.toLowerCase().includes(q) ||
          i.partCode?.toLowerCase().includes(q) ||
          i.serialNumber?.toLowerCase().includes(q) ||
          i.oem?.name?.toLowerCase().includes(q) ||
          i.spareId?.toLowerCase().includes(q)
      );
    }

    return items;
  }, [inventoryItemsData, selectedStore, activeCardFilter, searchQuery]);

  // Filter Activities & Audit Logs
  const filteredActivities = useMemo(() => {
    const activities = data?.recentActivities || [];
    if (!Array.isArray(activities)) return [];
    let items = [...activities];
    const todayStr = new Date().toISOString().split('T')[0];

    if (activeCardFilter === 'TODAYS_ACTIVITIES') {
      items = items.filter((act: any) => {
        if (!act.createdAt) return true;
        const d = new Date(act.createdAt).toISOString().split('T')[0];
        return d === todayStr;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (act: any) =>
          act.userName?.toLowerCase().includes(q) ||
          act.action?.toLowerCase().includes(q) ||
          act.module?.toLowerCase().includes(q) ||
          act.entityLabel?.toLowerCase().includes(q)
      );
    }

    return items;
  }, [data?.recentActivities, activeCardFilter, searchQuery]);

  // Filter Dispatches
  const filteredDispatches = useMemo(() => {
    const dispatches = (dispatchesQueryData && dispatchesQueryData.length > 0) ? dispatchesQueryData : (data?.recentDispatches || []);
    if (!Array.isArray(dispatches)) return [];
    let items = [...dispatches];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (d: any) =>
          d.dispatchNo?.toLowerCase().includes(q) ||
          d.inventoryItem?.productName?.toLowerCase().includes(q) ||
          d.site?.siteName?.toLowerCase().includes(q)
      );
    }

    return items;
  }, [dispatchesQueryData, data?.recentDispatches, searchQuery]);

  // Filter Pickups
  const filteredPickups = useMemo(() => {
    const pickups = (pickupsQueryData && pickupsQueryData.length > 0) ? pickupsQueryData : (data?.recentPickups || []);
    if (!Array.isArray(pickups)) return [];
    let items = [...pickups];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (p: any) =>
          p.pickupNo?.toLowerCase().includes(q) ||
          p.inventoryItem?.productName?.toLowerCase().includes(q) ||
          p.site?.siteName?.toLowerCase().includes(q)
      );
    }

    return items;
  }, [pickupsQueryData, data?.recentPickups, searchQuery]);

  // Filter Failed Logins
  const filteredFailedLogins = useMemo(() => {
    const activities = data?.recentActivities || [];
    if (!Array.isArray(activities)) return [];
    let items = activities.filter(
      (act: any) =>
        (act.action || '').toUpperCase().includes('FAILED') ||
        (act.action || '').toUpperCase().includes('LOGIN_FAILED')
    );

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (act: any) =>
          act.userName?.toLowerCase().includes(q) ||
          act.entityLabel?.toLowerCase().includes(q)
      );
    }

    return items;
  }, [data?.recentActivities, searchQuery]);

  // Real-time OEM Breakdown Calculation with Store Location Filtering & Total Uploaded Stock (Available + Reserved)
  const oemBreakdown = useMemo(() => {
    if (!inventoryItemsData || !Array.isArray(inventoryItemsData)) {
      return {
        oemList: [],
        grandTotalSerialized: 0,
        grandTotalNonSerialized: 0,
        grandTotalAvailable: 0,
        grandTotalReserved: 0,
        grandTotalUploaded: 0,
        distinctOemCount: 0,
        totalSpareTypes: 0,
      };
    }

    // Filter items based on selected store location (Delhi vs Bengaluru vs All Stores)
    let itemsToProcess = inventoryItemsData;
    if (selectedStore === 'DELHI') {
      itemsToProcess = inventoryItemsData.filter((i: any) => getStoreName(i).includes('delhi'));
    } else if (selectedStore === 'BENGALURU') {
      itemsToProcess = inventoryItemsData.filter((i: any) =>
        getStoreName(i).includes('bengaluru') || getStoreName(i).includes('blr')
      );
    }

    const map = new Map<string, {
      oemName: string;
      stores: Set<string>;
      partCodes: Set<string>;
      serializedCount: number;
      nonSerializedCount: number;
      availableQuantity: number;
      reservedQuantity: number;
      totalUploadedQuantity: number;
    }>();

    for (const item of itemsToProcess) {
      const oemName = (item.oem?.name || item.oemName || item.oem || 'Standard OEM').trim();
      const rawStore = item.store || item.location?.name || 'Delhi';
      const storeName = rawStore.toString().trim();
      const partCode = (item.partCode || item.spareId || item.productName || '').trim();

      const existing = map.get(oemName) || {
        oemName,
        stores: new Set<string>(),
        partCodes: new Set<string>(),
        serializedCount: 0,
        nonSerializedCount: 0,
        availableQuantity: 0,
        reservedQuantity: 0,
        totalUploadedQuantity: 0,
      };

      if (storeName) existing.stores.add(storeName);
      if (partCode) existing.partCodes.add(partCode);

      const availQty = getAvailableQty(item);
      const resQty = getReservedQty(item);
      const totalUploaded = availQty + resQty;
      const isSer = isItemSerialized(item);

      if (isSer) {
        existing.serializedCount += totalUploaded;
      } else {
        existing.nonSerializedCount += totalUploaded;
      }

      existing.availableQuantity += availQty;
      existing.reservedQuantity += resQty;
      existing.totalUploadedQuantity += totalUploaded;

      map.set(oemName, existing);
    }

    let oemList = Array.from(map.values()).map((entry) => {
      let storeLocationStr = '';
      if (selectedStore === 'DELHI') {
        storeLocationStr = 'Delhi Store';
      } else if (selectedStore === 'BENGALURU') {
        storeLocationStr = 'Bengaluru Store';
      } else {
        const storeArray = Array.from(entry.stores);
        if (storeArray.length === 0) storeLocationStr = 'Delhi Store';
        else if (storeArray.length === 1) storeLocationStr = storeArray[0].includes('Store') ? storeArray[0] : `${storeArray[0]} Store`;
        else storeLocationStr = 'Delhi & Bengaluru';
      }

      return {
        oemName: entry.oemName,
        storeLocation: storeLocationStr,
        spareTypesCount: entry.partCodes.size,
        serializedCount: entry.serializedCount,
        nonSerializedCount: entry.nonSerializedCount,
        availableQuantity: entry.availableQuantity,
        reservedQuantity: entry.reservedQuantity,
        totalUploadedQuantity: entry.totalUploadedQuantity,
      };
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      oemList = oemList.filter(
        (oem) =>
          oem.oemName.toLowerCase().includes(q) ||
          oem.storeLocation.toLowerCase().includes(q)
      );
    }

    oemList.sort((a, b) => a.oemName.localeCompare(b.oemName));

    const grandTotalSerialized = oemList.reduce((sum, o) => sum + o.serializedCount, 0);
    const grandTotalNonSerialized = oemList.reduce((sum, o) => sum + o.nonSerializedCount, 0);
    const grandTotalAvailable = oemList.reduce((sum, o) => sum + o.availableQuantity, 0);
    const grandTotalReserved = oemList.reduce((sum, o) => sum + o.reservedQuantity, 0);
    const grandTotalUploaded = oemList.reduce((sum, o) => sum + o.totalUploadedQuantity, 0);
    const totalSpareTypes = oemList.reduce((sum, o) => sum + o.spareTypesCount, 0);

    return {
      oemList,
      grandTotalSerialized,
      grandTotalNonSerialized,
      grandTotalAvailable,
      grandTotalReserved,
      grandTotalUploaded,
      distinctOemCount: oemList.length,
      totalSpareTypes,
    };
  }, [inventoryItemsData, selectedStore, searchQuery]);

  // Store-specific Stock Breakdown calculations (for Delhi Store & Bengaluru Store views)
  const storeStockBreakdown = useMemo(() => {
    if (!inventoryItemsData || !Array.isArray(inventoryItemsData)) {
      return {
        items: [],
        totalSerialized: 0,
        totalNonSerialized: 0,
        totalAvailable: 0,
        totalReserved: 0,
        grandTotalQuantity: 0,
      };
    }

    let items = [...inventoryItemsData];

    if (activeCardFilter === 'DELHI_STORE' || selectedStore === 'DELHI') {
      items = items.filter((i: any) => getStoreName(i).includes('delhi'));
    } else if (activeCardFilter === 'BENGALURU_STORE' || selectedStore === 'BENGALURU') {
      items = items.filter((i: any) => getStoreName(i).includes('bengaluru') || getStoreName(i).includes('blr'));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (i: any) =>
          i.productName?.toLowerCase().includes(q) ||
          i.partCode?.toLowerCase().includes(q) ||
          i.serialNumber?.toLowerCase().includes(q) ||
          i.oem?.name?.toLowerCase().includes(q) ||
          i.spareId?.toLowerCase().includes(q)
      );
    }

    const processedItems = items.map((item: any) => {
      const isSer = isItemSerialized(item);
      const avail = getAvailableQty(item);
      const res = getReservedQty(item);
      const total = avail + res;
      const storeRaw = item.store || item.location?.name || (getStoreName(item).includes('bengaluru') ? 'Bengaluru' : 'Delhi');

      return {
        ...item,
        isSer,
        availQty: avail,
        reservedQty: res,
        totalQty: total,
        displayStore: storeRaw.includes('Bengaluru') || storeRaw.includes('blr') ? 'Bengaluru Store' : 'Delhi Store',
      };
    });

    let totalSerialized = 0;
    let totalNonSerialized = 0;
    let totalAvailable = 0;
    let totalReserved = 0;
    let grandTotalQuantity = 0;

    for (const p of processedItems) {
      if (p.isSer) {
        totalSerialized += p.totalQty;
      } else {
        totalNonSerialized += p.totalQty;
      }
      totalAvailable += p.availQty;
      totalReserved += p.reservedQty;
      grandTotalQuantity += p.totalQty;
    }

    return {
      items: processedItems,
      totalSerialized,
      totalNonSerialized,
      totalAvailable,
      totalReserved,
      grandTotalQuantity,
    };
  }, [inventoryItemsData, activeCardFilter, selectedStore, searchQuery]);

  const isOemCategory = activeCardFilter === 'TOTAL_OEM';
  const isStoreCategory = activeCardFilter === 'DELHI_STORE' || activeCardFilter === 'BENGALURU_STORE';
  const isStockCategory = ['TOTAL_SPARE_PARTS', 'SERIALIZED_PARTS', 'NON_SERIALIZED', 'LOW_STOCK', 'OUT_OF_STOCK'].includes(activeCardFilter);
  const isActivityCategory = ['TODAYS_ACTIVITIES', 'AUDIT_LOGS'].includes(activeCardFilter);
  const isDispatchCategory = activeCardFilter === 'TODAYS_DISPATCH';
  const isPickupCategory = activeCardFilter === 'TODAYS_PICKUP';
  const isFailedLoginsCategory = activeCardFilter === 'FAILED_LOGINS';

  const currentListLength = isOemCategory
    ? oemBreakdown.oemList.length
    : isStoreCategory
    ? storeStockBreakdown.items.length
    : isStockCategory
    ? filteredInventoryItems.length
    : isActivityCategory
    ? filteredActivities.length
    : isDispatchCategory
    ? filteredDispatches.length
    : isPickupCategory
    ? filteredPickups.length
    : filteredFailedLogins.length;

  if (isLoading) {
    return (
      <Layout title="Dashboard & Analytics">
        <div className="flex flex-col items-center justify-center h-80 gap-4 text-slate-400">
          <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold tracking-wide text-indigo-600">Loading enterprise metrics...</span>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Dashboard & Analytics">
        <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm font-bold">
          ⚠️ Failed to load dashboard. Please verify backend server connectivity.
        </div>
      </Layout>
    );
  }

  const quickActions = [
    { label: 'Import Excel', icon: Upload, path: '/stock-list?action=import', gradient: 'from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 border-b-2 border-indigo-900/30' },
    { label: 'Dispatch Spare', icon: Truck, path: '/dispatch', gradient: 'from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 border-b-2 border-rose-900/30' },
    { label: 'Pickup Spare', icon: RotateCcw, path: '/pickup', gradient: 'from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 border-b-2 border-emerald-900/30' },
    { label: 'Reports', icon: FileSpreadsheet, path: '/reports', gradient: 'from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 border-b-2 border-amber-900/30' },
  ];

  const topSummaryCards = [
    { id: 'TOTAL_SPARE_PARTS', title: 'Total Spare Parts', value: inv.totalSpareParts ?? 0, icon: Package, color: 'text-blue-600' },
    { id: 'SERIALIZED_PARTS', title: 'Serialized Parts', value: inv.totalSerializedParts ?? 0, icon: Archive, color: 'text-indigo-600' },
    { id: 'NON_SERIALIZED', title: 'Non-Serialized', value: inv.totalNonSerializedParts ?? 0, icon: Layers, color: 'text-purple-600' },
    { id: 'TOTAL_OEM', title: 'Total OEMs', value: inv.totalOEMs ?? 0, icon: Cpu, color: 'text-cyan-600' },
    ...warehouseCards,
    { id: 'LOW_STOCK', title: 'Low Stock Items', value: inv.lowStockCount ?? 0, icon: AlertTriangle, color: 'text-amber-600' },
    { id: 'OUT_OF_STOCK', title: 'Out of Stock', value: inv.outOfStockCount ?? 0, icon: XCircle, color: 'text-rose-600' },
    { id: 'TODAYS_ACTIVITIES', title: "Today's Activities", value: inv.todaysActivitiesCount ?? 0, icon: History, color: 'text-indigo-700' },
    { id: 'AUDIT_LOGS', title: 'Total Audit Logs', value: inv.totalActivitiesCount ?? 0, icon: Activity, color: 'text-purple-700' },
    { id: 'TODAYS_DISPATCH', title: "Today's Dispatch", value: inv.todaysDispatchCount ?? 0, icon: Truck, color: 'text-blue-700' },
    { id: 'TODAYS_PICKUP', title: "Today's Pickup", value: inv.todaysPickupCount ?? 0, icon: RotateCcw, color: 'text-emerald-700' },
    { id: 'FAILED_LOGINS', title: 'Failed Login Attempts', value: inv.failedLoginAttemptsCount ?? 0, icon: ShieldAlert, color: 'text-rose-700' },
  ];

  const activeCardObj = topSummaryCards.find((c) => c.id === activeCardFilter) || topSummaryCards[0];

  return (
    <Layout title="Dashboard & Overview">
      {/* Hero Welcome Banner with 3D Depth */}
      <div
        className="relative overflow-hidden rounded-2xl p-6 mb-6 border border-indigo-100 bg-gradient-to-br from-indigo-50/90 via-purple-50/40 to-white shadow-lg transition-transform"
        style={{ boxShadow: '0 10px 30px -5px rgba(99,102,241,0.08), inset 0 1px 0 0 rgba(255,255,255,1)' }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-600">Proactive Spare IMS</span>
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Enterprise Stock List Dashboard</h1>
            <p className="text-xs text-slate-600 mt-1 max-w-xl font-medium">
              Real-time spare parts monitoring across active warehouses, {activeOrgObj.name} dispatch tracking, and OEM replacements.
            </p>
          </div>
        </div>
      </div>

      {/* Top Metric Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {topSummaryCards.map((card) => (
          <StatCard
            key={card.id}
            title={card.title}
            value={card.value}
            icon={card.icon}
            color={card.color}
          />
        ))}
      </div>

      {/* Store Distribution Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-6">
        {selectedOrg === 'BHEL' ? (
          <>
            {/* Delhi Store */}
            <Card
              className={`border-l-4 border-l-blue-600 transition-all hover:shadow-md ${selectedStore === 'DELHI' ? 'ring-2 ring-blue-500 bg-blue-50/20' : ''}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-200 shadow-inner">
                    <MapPin className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">Delhi Stock Store</p>
                    <p className="text-[11px] text-slate-500 font-medium">Proactive Delhi Warehouse</p>
                  </div>
                </div>
                <Badge variant="info">Primary</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-gradient-to-b from-slate-50 to-slate-100/70 border border-slate-200/80 rounded-xl p-3 text-center shadow-inner">
                  <p className="text-xl font-extrabold text-slate-900">{delhi.totalQuantity ?? delhi.totalItems ?? 0}</p>
                  <p className="text-[10px] font-bold text-slate-600 mt-0.5">Total Uploaded</p>
                </div>
                <div className="bg-gradient-to-b from-slate-50 to-slate-100/70 border border-slate-200/80 rounded-xl p-3 text-center shadow-inner">
                  <p className="text-xl font-extrabold text-emerald-600">{delhi.availableQuantity ?? 0}</p>
                  <p className="text-[10px] font-bold text-slate-600 mt-0.5">Available</p>
                </div>
                <div className="bg-gradient-to-b from-slate-50 to-slate-100/70 border border-slate-200/80 rounded-xl p-3 text-center shadow-inner">
                  <p className="text-xl font-extrabold text-amber-600">{Math.max(0, (delhi.totalQuantity ?? 0) - (delhi.availableQuantity ?? 0))}</p>
                  <p className="text-[10px] font-bold text-slate-600 mt-0.5">Reserved</p>
                </div>
              </div>
            </Card>

            {/* Bengaluru Store */}
            <Card
              className={`border-l-4 border-l-orange-500 transition-all hover:shadow-md ${selectedStore === 'BENGALURU' ? 'ring-2 ring-orange-500 bg-orange-50/20' : ''}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center border border-orange-200 shadow-inner">
                    <MapPin className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">Bengaluru Stock Store</p>
                    <p className="text-[11px] text-slate-500 font-medium">Proactive South Warehouse</p>
                  </div>
                </div>
                <Badge variant="warning">Regional</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-gradient-to-b from-slate-50 to-slate-100/70 border border-slate-200/80 rounded-xl p-3 text-center shadow-inner">
                  <p className="text-xl font-extrabold text-slate-900">{blr.totalQuantity ?? blr.totalItems ?? 0}</p>
                  <p className="text-[10px] font-bold text-slate-600 mt-0.5">Total Uploaded</p>
                </div>
                <div className="bg-gradient-to-b from-slate-50 to-slate-100/70 border border-slate-200/80 rounded-xl p-3 text-center shadow-inner">
                  <p className="text-xl font-extrabold text-emerald-600">{blr.availableQuantity ?? 0}</p>
                  <p className="text-[10px] font-bold text-slate-600 mt-0.5">Available</p>
                </div>
                <div className="bg-gradient-to-b from-slate-50 to-slate-100/70 border border-slate-200/80 rounded-xl p-3 text-center shadow-inner">
                  <p className="text-xl font-extrabold text-amber-600">{Math.max(0, (blr.totalQuantity ?? 0) - (blr.availableQuantity ?? 0))}</p>
                  <p className="text-[10px] font-bold text-slate-600 mt-0.5">Reserved</p>
                </div>
              </div>
            </Card>
          </>
        ) : (
          <Card
            className="border-l-4 border-l-emerald-600 transition-all hover:shadow-md col-span-1 md:col-span-2"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-200 shadow-inner">
                  <MapPin className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{warehouses[0]?.name || `${activeOrgObj.name} Store`}</p>
                  <p className="text-[11px] text-slate-500 font-medium">Primary Client Warehouse Hub</p>
                </div>
              </div>
              <Badge variant="success">Active Store</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-gradient-to-b from-slate-50 to-slate-100/70 border border-slate-200/80 rounded-xl p-3 text-center shadow-inner">
                <p className="text-xl font-extrabold text-slate-900">{inv.totalSpareParts ?? 0}</p>
                <p className="text-[10px] font-bold text-slate-600 mt-0.5">Total Uploaded</p>
              </div>
              <div className="bg-gradient-to-b from-slate-50 to-slate-100/70 border border-slate-200/80 rounded-xl p-3 text-center shadow-inner">
                <p className="text-xl font-extrabold text-emerald-600">{inv.totalSerializedParts ?? 0}</p>
                <p className="text-[10px] font-bold text-slate-600 mt-0.5">Available</p>
              </div>
              <div className="bg-gradient-to-b from-slate-50 to-slate-100/70 border border-slate-200/80 rounded-xl p-3 text-center shadow-inner">
                <p className="text-xl font-extrabold text-amber-600">{Math.max(0, (inv.totalSpareParts ?? 0) - (inv.totalSerializedParts ?? 0))}</p>
                <p className="text-[10px] font-bold text-slate-600 mt-0.5">Reserved</p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Monthly Dispatch & Pickup Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <Card title="Monthly Dispatches" subtitle={`Outbound spares movement to ${activeOrgObj.name} sites`}>
          <div className="h-56 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.monthlyDispatches || []}>
                <defs>
                  <linearGradient id="dispatchGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', color: '#0f172a', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }} />
                <Area type="monotone" dataKey="count" name="Dispatches" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#dispatchGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Monthly Pickups" subtitle="Inbound spares & OEM returns">
          <div className="h-56 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.monthlyPickups || []}>
                <defs>
                  <linearGradient id="pickupGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', color: '#0f172a', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }} />
                <Area type="monotone" dataKey="count" name="Pickups" stroke="#059669" strokeWidth={3} fillOpacity={1} fill="url(#pickupGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* OEM Distribution & Activity Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* OEM Breakdown */}
        <Card title="OEM Breakdown" subtitle="Distribution of spares by OEM">
          <div className="h-56 mt-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={(data?.oemDistribution || []).slice(0, 9)}
                  dataKey="count"
                  nameKey="name"
                  cx="50%" cy="50%"
                  outerRadius={75}
                  innerRadius={35}
                  paddingAngle={3}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                  fontSize={10}
                >
                  {(data?.oemDistribution || []).slice(0, 9).map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', color: '#0f172a', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Live Activity Feed / Timeline */}
        <div className="lg:col-span-2">
          <Card title="Recent Activity Timeline" subtitle="Audit logs & change history" action={
            <button onClick={() => navigate('/activity')} className="text-xs text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1">
              Full Activity Log <ChevronRight className="w-3 h-3" />
            </button>
          }>
            <div className="space-y-2 mt-1 max-h-60 overflow-y-auto pr-1">
              {(data?.recentActivities || []).length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6 font-medium">No recent activity recorded</p>
              ) : (
                (data?.recentActivities || []).map((log: any, i: number) => {
                  const userName = log.userName || log.user?.name || 'System';
                  const userRole = log.userRole || log.user?.role || 'SYSTEM';
                  return (
                    <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition-colors shadow-2xs">
                      <Activity className="w-3.5 h-3.5 text-indigo-600 mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs">{userName}</span>
                          <span className="bg-indigo-100 text-indigo-800 text-[10px] px-1.5 py-0.2 rounded font-extrabold uppercase">{userRole}</span>
                          <span className="text-slate-400 text-xs">•</span>
                          <span className="font-bold text-indigo-600 text-xs">{log.action}</span>
                          {log.module && <span className="bg-slate-200 text-slate-800 text-[10px] px-1.5 rounded font-bold">{log.module}</span>}
                        </div>
                        {log.entityLabel && <p className="text-xs text-slate-700 font-medium mt-0.5">{log.entityLabel}</p>}
                        {log.oldValue && log.newValue && (
                          <p className="text-[11px] text-slate-600 font-mono mt-1 bg-white p-1.5 rounded border border-slate-200">
                            <span className="text-rose-700 font-bold">{log.oldValue}</span>
                            <ArrowRight className="w-3 h-3 inline mx-1 text-slate-400" />
                            <span className="text-emerald-700 font-bold">{log.newValue}</span>
                          </p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-1 font-mono">{new Date(log.createdAt).toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Recent Dispatches & Pickups & Low Stock Rows */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Dispatches */}
        <Card title="Recent Dispatches" action={
          <button onClick={() => navigate('/dispatch')} className="text-xs text-indigo-600 font-bold flex items-center gap-1">View All <ChevronRight className="w-3 h-3" /></button>
        }>
          <div className="space-y-2 mt-1">
            {(data?.recentDispatches || []).length === 0
              ? <p className="text-xs text-slate-500 text-center py-6 font-medium">No dispatch records found</p>
              : (data?.recentDispatches || []).map((d: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">{d.inventoryItem?.productName}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{d.site?.siteName} · {d.dispatchNo}</p>
                  </div>
                  <Badge variant="warning">RESERVED</Badge>
                </div>
              ))}
          </div>
        </Card>

        {/* Recent Pickups */}
        <Card title="Recent Pickups" action={
          <button onClick={() => navigate('/pickup')} className="text-xs text-indigo-600 font-bold flex items-center gap-1">View All <ChevronRight className="w-3 h-3" /></button>
        }>
          <div className="space-y-2 mt-1">
            {(data?.recentPickups || []).length === 0
              ? <p className="text-xs text-slate-500 text-center py-6 font-medium">No pickup records found</p>
              : (data?.recentPickups || []).map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">{p.inventoryItem?.productName}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{p.site?.siteName} · {p.pickupNo}</p>
                  </div>
                  <Badge variant="success">IN</Badge>
                </div>
              ))}
          </div>
        </Card>

        {/* Low Stock Alerts */}
        <Card title="Low Stock Monitoring (<= 50% Stock Available)">
          <div className="space-y-2 mt-1">
            {(data?.lowStockAlerts || []).length === 0
              ? <div className="flex flex-col items-center py-6 gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                <p className="text-xs font-bold text-slate-700">All inventory levels healthy</p>
              </div>
              : (data?.lowStockAlerts || []).map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 border border-amber-200/80">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      <span className="font-mono text-indigo-700 font-bold mr-1.5">{item.partCode}</span>
                      {item.productName}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">{item.oemName || item.oem?.name}</p>
                  </div>
                  <span className={`text-[11px] font-mono font-extrabold px-2.5 py-1 rounded-lg shrink-0 ${item.availableQuantity === 0 ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-amber-100 text-amber-800 border border-amber-300'}`}>
                    {item.availableQuantity === 0 ? '0 Out of Stock' : `${item.availableQuantity} / ${item.totalQuantity} (${item.percentRemaining}%)`}
                  </span>
                </div>
              ))}
          </div>
        </Card>
      </div>

      {/* 3. LOW STOCK BREAKDOWN MODAL POPUP */}
      {isStockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]">

            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-amber-50/80 via-orange-50/40 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0 shadow-xs">
                  <AlertTriangle className="w-5 h-5 text-amber-600 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Low Stock Devices Breakdown</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Listing all parts currently requiring reorder attention ({((dynamicLowStock?.lowStockItems || []) as any[]).length + ((dynamicLowStock?.outOfStockItems || []) as any[]).length} items total)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsStockModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center text-lg transition-colors cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Table View of Low Stock Items */}
            <div className="p-5 overflow-y-auto flex-1">
              {isLoadingDynamic ? (
                <div className="text-center py-12 text-slate-400 text-sm font-semibold flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  Fetching live stock breakdown data...
                </div>
              ) : (dynamicLowStock?.lowStockItems || []).length === 0 && (dynamicLowStock?.outOfStockItems || []).length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm font-semibold flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                  All inventory items are sufficiently stocked!
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 font-extrabold border-b border-slate-200">
                        <th className="p-3">#</th>
                        <th className="p-3">Part ID</th>
                        <th className="p-3">Part Name / Device</th>
                        <th className="p-3">Category / OEM</th>
                        <th className="p-3 text-center">Available Stock</th>
                        <th className="p-3 text-center">50% Reorder Limit</th>
                        <th className="p-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-900">
                      {/* Out of stock items */}
                      {(dynamicLowStock?.outOfStockItems || []).map((item: any, idx: number) => {
                        const partId = item.partId || item.spareId || item.partCode || 'N/A';
                        const name = item.productName || item.partName || 'Spare Item';
                        const category = item.category || item.oemName || 'General';
                        const min = Math.ceil((item.totalQuantity || item.initialQuantity || 10) * 0.5);

                        return (
                          <tr key={`out-${idx}`} className="bg-rose-50/50 hover:bg-rose-100/50 transition-colors">
                            <td className="p-3 text-slate-400 font-bold">{idx + 1}</td>
                            <td className="p-3 font-mono font-extrabold text-rose-900">{partId}</td>
                            <td className="p-3 font-bold text-slate-900">{name}</td>
                            <td className="p-3 text-slate-600 font-medium">{category}</td>
                            <td className="p-3 text-center font-black text-rose-700">0</td>
                            <td className="p-3 text-center text-slate-600 font-semibold">{min} (50% threshold)</td>
                            <td className="p-3 text-right">
                              <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-black text-[10px] uppercase border border-rose-300">
                                OUT OF STOCK
                              </span>
                            </td>
                          </tr>
                        );
                      })}

                      {/* Low stock items */}
                      {(dynamicLowStock?.lowStockItems || []).map((item: any, idx: number) => {
                        const partId = item.partId || item.spareId || item.partCode || 'N/A';
                        const name = item.productName || item.partName || 'Spare Item';
                        const category = item.category || item.oemName || 'General';
                        const avail = item.quantity ?? item.availableQuantity ?? 0;
                        const min = Math.ceil((item.totalQuantity || item.initialQuantity || (avail * 2)) * 0.5);

                        return (
                          <tr key={`low-${idx}`} className="hover:bg-amber-50/40 transition-colors">
                            <td className="p-3 text-slate-400 font-bold">{(dynamicLowStock?.outOfStockItems || []).length + idx + 1}</td>
                            <td className="p-3 font-mono font-extrabold text-amber-900">{partId}</td>
                            <td className="p-3 font-bold text-slate-900">{name}</td>
                            <td className="p-3 text-slate-600 font-medium">{category}</td>
                            <td className="p-3 text-center font-black text-amber-700">{avail}</td>
                            <td className="p-3 text-center text-slate-600 font-semibold">{min}</td>
                            <td className="p-3 text-right">
                              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-black text-[10px] uppercase border border-amber-300">
                                LOW STOCK
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
              <span className="text-xs text-slate-500 font-medium">
                Total Low Stock Parts: <strong className="text-slate-900 font-extrabold font-mono">{(dynamicLowStock?.lowStockItems || []).length + (dynamicLowStock?.outOfStockItems || []).length}</strong>
              </span>
              <button
                type="button"
                onClick={() => setIsStockModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
