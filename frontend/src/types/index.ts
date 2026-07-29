export type UserRole = 'SUPER_ADMIN' | 'INVENTORY_ADMIN' | 'ENGINEER' | 'READ_ONLY';

export type InventoryStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'DISPATCHED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'UNDER_REPAIR'
  | 'SCRAPPED'
  | 'RMA_PENDING'
  | 'RMA_SENT'
  | 'RMA_RECEIVED';

export type DispatchStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'CANCELLED';

export type PickupStatus = 'DRAFT' | 'ASSIGNED' | 'IN_TRANSIT' | 'PICKED_UP' | 'RECEIVED' | 'CANCELLED';

export type RMAStatus =
  | 'RAISED'
  | 'APPROVED'
  | 'SENT'
  | 'RECEIVED'
  | 'REPLACEMENT_RECEIVED'
  | 'CLOSED'
  | 'REJECTED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  isActive?: boolean;
  lastLoginAt?: string | Date;
  createdAt?: string | Date;
}

export interface OEM {
  id: string;
  name: string;
  isActive?: boolean;
}

export interface Category {
  id: string;
  name: string;
  oemId: string;
  oem?: OEM;
}

export interface Location {
  id: string;
  name: string;
  city?: string;
}

export interface Site {
  id: string;
  siteCode?: string;
  siteName: string;
  unitDivision?: string;
  subLocation?: string;
  locationClass?: string;
  spareStore?: string;
  addressLine1?: string;
  addressLine2?: string;
  fullAddress?: string;
  city?: string;
  state?: string;
  pin?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  remarks?: string;
}

export interface Comment {
  id: string;
  inventoryItemId: string;
  userId: string;
  user: { id: string; name: string; email: string; role: string };
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMovement {
  id: string;
  inventoryItemId: string;
  type: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  referenceId?: string;
  performedBy: { name: string };
  remarks?: string;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  spareId: string;
  oemId: string;
  oem: OEM;
  categoryId: string;
  category: Category;
  productName: string;
  description?: string;
  model?: string;
  partId?: string;
  partCode?: string;
  serialNumber?: string;
  isSerialized?: boolean;
  quantity: number;
  availableQuantity: number;
  unit: string;
  store: 'Delhi' | 'Bengaluru';
  locationId?: string;
  location?: Location;
  rack?: string;
  bin?: string;
  condition?: string;
  warrantyStart?: string;
  warrantyEnd?: string;
  purchaseDate?: string;
  status: InventoryStatus;
  reservedFor?: string;
  remarks?: string;
  qrCode?: string;
  barcode?: string;
  comments?: Comment[];
  movements?: InventoryMovement[];
  createdAt: string;
  updatedAt: string;
}

export interface Dispatch {
  id: string;
  dispatchNo: string;
  inventoryItemId: string;
  inventoryItem: Partial<InventoryItem>;
  siteId: string;
  site: Site;
  quantity: number;
  courierName?: string;
  trackingNo?: string;
  dispatchDate?: string;
  expectedDelivery?: string;
  status: DispatchStatus;
  remarks?: string;
  createdBy: Partial<User>;
  approvedBy?: Partial<User>;
  createdAt: string;
}

export interface Pickup {
  id: string;
  pickupNo: string;
  inventoryItemId: string;
  inventoryItem: Partial<InventoryItem>;
  siteId: string;
  site: Site;
  quantity: number;
  courierName?: string;
  trackingNo?: string;
  pickupDate?: string;
  faultDescription?: string;
  status: PickupStatus;
  receivedConfirmed: boolean;
  createdBy?: Partial<User>;
  createdAt: string;
}

export interface RMA {
  id: string;
  rmaNo: string;
  inventoryItemId: string;
  inventoryItem: Partial<InventoryItem>;
  status: RMAStatus;
  oemTicketNo?: string;
  remarks?: string;
  timeline?: Array<{ status: string; date: string; note?: string; userId: string }>;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  user: User;
  action: string;
  entity: string;
  entityId?: string;
  entityLabel?: string;
  ipAddress?: string;
  createdAt: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
