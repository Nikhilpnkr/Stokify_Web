export type CropBatch = {
  id: string;
  cropType: string;
  quantity: number; // in bags
  storageDurationMonths: 1 | 6 | 12; // in months
  storageCost: number;
  storageLocationId: string;
  dateAdded: string;
  ownerId: string;
};

export type StorageLocation = {
  id: string;
  name: string;
  capacity: number; // in bags
  ownerId: string;
  location: string;
};

export type UserProfile = {
  uid: string;
  displayName: string;
  email: string;
  mobileNumber?: string;
};

export const STORAGE_RATES: { [key in CropBatch['storageDurationMonths']]: number } = {
  1: 10,
  6: 36,
  12: 56,
};
