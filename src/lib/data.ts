

export type AreaAllocation = {
  areaId: string;
  quantity: number;
}

export type CropBatch = {
  id: string;
  cropType: string;
  areaAllocations: AreaAllocation[];
  storageLocationId: string;
  dateAdded: string;
  ownerId: string;
  customerId: string;
  customerName: string;
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

export type UserProfile = {
  uid: string;
  displayName: string;
  email: string;
  mobileNumber?: string;
};

export type CropType = {
  id: string;
  name: string;
  rates: {
    '1': number;
    '6': number;
    '12': number;
  };
  ownerId: string;
};

export type Customer = {
  id: string;
  name: string;
  mobileNumber: string;
  ownerId: string;
};


// This can now be used as a default or fallback.
export const STORAGE_RATES: { [key in 1 | 6 | 12]: number } = {
  1: 10,
  6: 36,
  12: 56,
};
