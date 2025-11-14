export type CropBatch = {
  id: string;
  cropType: string;
  quantity: number; // in bags
  storageDuration: 1 | 6 | 12; // in months
  storageCost: number;
  locationId: string;
  dateAdded: string;
};

export type StorageLocation = {
  id: string;
  name: string;
  capacity: number; // in bags
};

export const STORAGE_RATES: { [key in CropBatch['storageDuration']]: number } = {
  1: 10,
  6: 36,
  12: 56,
};

export const initialStorageLocations: StorageLocation[] = [
  { id: 'loc1', name: 'Warehouse A', capacity: 1000 },
  { id: 'loc2', name: 'Silo B-01', capacity: 500 },
  { id: 'loc3', name: 'Barn C', capacity: 250 },
];

export const initialCropBatches: CropBatch[] = [
  {
    id: 'batch1',
    cropType: 'Wheat',
    quantity: 200,
    storageDuration: 6,
    locationId: 'loc1',
    dateAdded: new Date(2023, 10, 15).toISOString(),
    storageCost: 36,
  },
  {
    id: 'batch2',
    cropType: 'Corn',
    quantity: 500,
    storageDuration: 12,
    locationId: 'loc1',
    dateAdded: new Date(2023, 8, 1).toISOString(),
    storageCost: 56,
  },
  {
    id: 'batch3',
    cropType: 'Soybeans',
    quantity: 300,
    storageDuration: 1,
    locationId: 'loc2',
    dateAdded: new Date(2024, 2, 10).toISOString(),
    storageCost: 10,
  },
  {
    id: 'batch4',
    cropType: 'Barley',
    quantity: 150,
    storageDuration: 6,
    locationId: 'loc3',
    dateAdded: new Date(2024, 0, 20).toISOString(),
    storageCost: 36,
  },
];
