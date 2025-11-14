
"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, formatDistanceToNow } from "date-fns";
import { AddBatchDialog } from "@/components/add-batch-dialog";
import { OutflowDialog } from "@/components/outflow-dialog";
import { useCollection, useFirebase, useUser, useMemoFirebase } from "@/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { CropBatch, StorageLocation, CropType, Customer, StorageArea } from "@/lib/data";


export default function InventoryPage() {
  const { firestore } = useFirebase();
  const { user } = useUser();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isOutflowDialogOpen, setIsOutflowDialogOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<CropBatch | null>(null);

  const cropBatchesQuery = useMemoFirebase(() =>
    user ? query(collection(firestore, 'cropBatches'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );
  const storageLocationsQuery = useMemoFirebase(() =>
    user ? query(collection(firestore, 'storageLocations'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );
  const cropTypesQuery = useMemoFirebase(() =>
    user ? query(collection(firestore, 'cropTypes'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );
  const customersQuery = useMemoFirebase(() =>
    user ? query(collection(firestore, 'customers'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );

  const { data: rawBatches, isLoading: isLoadingBatches } = useCollection<CropBatch>(cropBatchesQuery);
  const { data: locations, isLoading: isLoadingLocations } = useCollection<StorageLocation>(storageLocationsQuery);
  const { data: cropTypes, isLoading: isLoadingCropTypes } = useCollection<CropType>(cropTypesQuery);
  const { data: customers, isLoading: isLoadingCustomers } = useCollection<Customer>(customersQuery);

  const [allAreas, setAllAreas] = useState<StorageArea[]>([]);
  const [isLoadingAreas, setIsLoadingAreas] = useState(false);

  // Fetch all areas from all locations
  useEffect(() => {
    async function fetchAllAreas() {
      if (!locations || locations.length === 0 || !firestore) {
        setAllAreas([]);
        return;
      };
      setIsLoadingAreas(true);
      const areas: StorageArea[] = [];
      for (const location of locations) {
        const areasColRef = collection(firestore, 'storageLocations', location.id, 'areas');
        const areasSnapshot = await getDocs(areasColRef);
        areasSnapshot.forEach(doc => {
          areas.push({ id: doc.id, ...doc.data() } as StorageArea);
        });
      }
      setAllAreas(areas);
      setIsLoadingAreas(false);
    }
    if(locations) fetchAllAreas();
  }, [locations, firestore]);

  const batches = useMemo(() => {
    if (!rawBatches) return [];
    return rawBatches.map(batch => ({
      ...batch,
      quantity: batch.areaAllocations?.reduce((sum, alloc) => sum + alloc.quantity, 0) || 0,
    }))
  }, [rawBatches]);

  const getLocationName = (locationId: string) => locations?.find(l => l.id === locationId)?.name || '...';
  const getAreaNames = (allocations: {areaId: string, quantity: number}[]) => {
    if (!allAreas || allAreas.length === 0) return '...';
    return allocations.map(alloc => allAreas.find(a => a.id === alloc.areaId)?.name).filter(Boolean).join(', ') || 'N/A';
  }
  const getCustomerMobile = (customerId: string) => customers?.find(c => c.id === customerId)?.mobileNumber || '...';

  const handleRowClick = (batch: CropBatch) => {
    setSelectedBatch(batch);
    setIsOutflowDialogOpen(true);
  };
  
  const isLoading = isLoadingBatches || isLoadingLocations || isLoadingCropTypes || isLoadingCustomers || isLoadingAreas;

  return (
    <>
      <PageHeader
        title="Crop Inflow / Inventory"
        description="A list of all crop batches currently in storage. Click a row to process outflow."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsAddDialogOpen(true)} disabled={!user}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add New Batch
            </Button>
          </div>
        }
      />
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Crop Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Area(s)</TableHead>
                <TableHead className="text-right">Quantity (bags)</TableHead>
                <TableHead>Date Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              ) : batches && batches.length > 0 ? batches.map((batch) => (
                <TableRow key={batch.id} onClick={() => handleRowClick(batch)} className="cursor-pointer">
                  <TableCell className="font-medium">{batch.customerName}</TableCell>
                  <TableCell>{getCustomerMobile(batch.customerId)}</TableCell>
                  <TableCell>{batch.cropType}</TableCell>
                  <TableCell>{getLocationName(batch.storageLocationId)}</TableCell>
                  <TableCell>{getAreaNames(batch.areaAllocations)}</TableCell>
                  <TableCell className="text-right">{batch.quantity.toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{format(new Date(batch.dateAdded), "MMM d, yyyy")}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(batch.dateAdded), { addSuffix: true })}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    No crop batches found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <AddBatchDialog
        isOpen={isAddDialogOpen}
        setIsOpen={setIsAddDialogOpen}
        locations={locations || []}
        cropTypes={cropTypes || []}
        customers={customers || []}
        allBatches={rawBatches || []}
      />
      {selectedBatch && (
        <OutflowDialog
            isOpen={isOutflowDialogOpen}
            setIsOpen={setIsOutflowDialogOpen}
            batch={selectedBatch}
            cropType={cropTypes?.find(ct => ct.name === selectedBatch.cropType)}
        />
      )}
    </>
  );
}
