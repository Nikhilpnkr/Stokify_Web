
"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Receipt, Users, Archive, Banknote } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, formatDistanceToNow } from "date-fns";
import { AddBatchDialog } from "@/components/add-batch-dialog";
import { OutflowDialog } from "@/components/outflow-dialog";
import { useCollection, useFirebase, useUser, useMemoFirebase } from "@/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { CropBatch, StorageLocation, CropType, Customer, StorageArea, Outflow } from "@/lib/data";


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
   const outflowsQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, 'outflows'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );

  const { data: rawBatches, isLoading: isLoadingBatches } = useCollection<CropBatch>(cropBatchesQuery);
  const { data: locations, isLoading: isLoadingLocations } = useCollection<StorageLocation>(storageLocationsQuery);
  const { data: cropTypes, isLoading: isLoadingCropTypes } = useCollection<CropType>(cropTypesQuery);
  const { data: customers, isLoading: isLoadingCustomers } = useCollection<Customer>(customersQuery);
  const { data: outflows, isLoading: isLoadingOutflows } = useCollection<Outflow>(outflowsQuery);

  const [allAreas, setAllAreas] = useState<StorageArea[]>([]);
  const [isLoadingAreas, setIsLoadingAreas] = useState(false);
  
  const { totalQuantity, totalOutstandingBalance } = useMemo(() => {
    const totalQty = rawBatches?.reduce((acc, b) => {
        const batchQty = b.areaAllocations?.reduce((sum, alloc) => sum + alloc.quantity, 0) || 0;
        return acc + batchQty;
    }, 0) || 0;

    const outstanding = outflows?.reduce((acc, o) => acc + o.balanceDue, 0) || 0;

    return { totalQuantity: totalQty, totalOutstandingBalance: outstanding };
  }, [rawBatches, outflows]);


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
  
  const isLoading = isLoadingBatches || isLoadingLocations || isLoadingCropTypes || isLoadingCustomers || isLoadingAreas || isLoadingOutflows;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="An overview of your crop inventory and business metrics."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsAddDialogOpen(true)} disabled={!user}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add New Batch
            </Button>
          </div>
        }
      />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stored Quantity</CardTitle>
            <Archive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalQuantity.toLocaleString()} bags</div>
            <p className="text-xs text-muted-foreground">Across {locations?.length || 0} locations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Currently storing crops</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Outstanding Balance</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalOutstandingBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
            <p className="text-xs text-muted-foreground">Across all transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Crop Batches</CardTitle>
            <div className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rawBatches?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Currently in storage</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Current Inventory</CardTitle>
            <CardDescription>A list of all crop batches currently in storage. Click the receipt icon to process outflow.</CardDescription>
        </CardHeader>
        <CardContent>
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              ) : batches && batches.length > 0 ? batches.map((batch) => (
                <TableRow key={batch.id}>
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
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleRowClick(batch)}>
                      <Receipt className="h-5 w-5" />
                      <span className="sr-only">Process Outflow for {batch.customerName}</span>
                    </Button>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
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

    