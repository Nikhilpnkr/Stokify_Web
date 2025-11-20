

export type AreaAllocation = {
  areaId: string;
  quantity: number;
}

export type Inflow = {
  id: string;
  cropType: string;
  areaAllocations: AreaAllocation[];
  storageLocationId: string;
  dateAdded: string;
  ownerId: string;
  customerId: string;
  labourCharge?: number;
  quantity: number; // This is a derived field for easier access
};

export type StorageLocation = {
  id: string;
  name: string;
  capacity: number; // in bags
  ownerId: string;
  mobileNumber: string;
  address: string;
};

export type StorageArea = {
  id: string;
  name: string;
  capacity: number; // in bags
  storageLocationId: string;
  ownerId: string;
};

export type UserRole = 'admin' | 'manager' | 'assistant' | 'user';

export type UserProfile = {
  uid: string;
  displayName: string;
  email: string;
  mobileNumber?: string;
  role: UserRole;
};

export type CropType = {
  id: string;
  name: string;
  rates: {
    '6': number;
    '12': number;
  };
  insurance?: number;
  ownerId: string;
};

export type Customer = {
  id: string;
  name: string;
  mobileNumber: string;
  ownerId: string;
};

export type Outflow = {
  id: string;
  inflowId: string;
  customerId: string;
  ownerId: string;
  date: string;
  quantityWithdrawn: number;
  totalBill: number;
  amountPaid: number;
  balanceDue: number;
  // Denormalized fields for robust reporting
  cropTypeName: string;
  locationName: string;
  // Fields to reconstruct invoice
  storageDuration: number;
  storageCost: number;
  insuranceCharge: number;
};

export type Payment = {
  id: string;
  outflowId: string;
  customerId: string;
  ownerId: string;
  date: string;
  amount: number;
  paymentMethod: 'Cash' | 'Card' | 'Online';
  notes?: string;
};

export interface PaymentReceiptData {
  paymentId: string;
  paymentDate: Date;
  paymentMethod: string;
  amountPaid: number;
  notes?: string;
  customer: {
      name: string;
      mobile: string;
  };
  outflowId: string;
  outflowDate: Date;
  totalBill: number;
  previousBalance: number;
  newBalance: number;
}

export type AuditLog = {
    id: string;
    ownerId: string;
    date: string;
    action: string;
    entityType: string;
    entityId: string;
    details: string;
};


// This can now be used as a default or fallback.
export const STORAGE_RATES: { [key in 6 | 12]: number } = {
  6: 36,
  12: 56,
};
