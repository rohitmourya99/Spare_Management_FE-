export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  INVENTORY_ADMIN: 'INVENTORY_ADMIN',
  ENGINEER: 'ENGINEER',
  READ_ONLY: 'READ_ONLY',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ActivityAction = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  DISPATCH: 'DISPATCH',
  PICKUP: 'PICKUP',
  RECEIVE: 'RECEIVE',
  RMA: 'RMA',
  APPROVE: 'APPROVE',
} as const;
export type ActivityAction = (typeof ActivityAction)[keyof typeof ActivityAction];

export const DispatchStatus = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  DISPATCHED: 'DISPATCHED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;
export type DispatchStatus = (typeof DispatchStatus)[keyof typeof DispatchStatus];

export const InventoryStatus = {
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  DISPATCHED: 'DISPATCHED',
  UNDER_MAINTENANCE: 'UNDER_MAINTENANCE',
  RMA_PENDING: 'RMA_PENDING',
  RMA_SENT: 'RMA_SENT',
  RMA_RECEIVED: 'RMA_RECEIVED',
  SCRAPPED: 'SCRAPPED',
} as const;
export type InventoryStatus = (typeof InventoryStatus)[keyof typeof InventoryStatus];

export const PickupStatus = {
  DRAFT: 'DRAFT',
  ASSIGNED: 'ASSIGNED',
  SCHEDULED: 'SCHEDULED',
  PICKED_UP: 'PICKED_UP',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
} as const;
export type PickupStatus = (typeof PickupStatus)[keyof typeof PickupStatus];

export const RMAStatus = {
  RAISED: 'RAISED',
  APPROVED: 'APPROVED',
  SENT: 'SENT',
  SENT_TO_OEM: 'SENT_TO_OEM',
  RECEIVED: 'RECEIVED',
  RECEIVED_FROM_OEM: 'RECEIVED_FROM_OEM',
  REPLACEMENT_RECEIVED: 'REPLACEMENT_RECEIVED',
  REPLACED: 'REPLACED',
  CLOSED: 'CLOSED',
  REJECTED: 'REJECTED',
} as const;
export type RMAStatus = (typeof RMAStatus)[keyof typeof RMAStatus];

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  DISABLED: 'DISABLED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

