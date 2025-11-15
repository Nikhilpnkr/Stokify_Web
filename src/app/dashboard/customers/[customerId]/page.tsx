
"use client";

import { useMemo, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useFirebase, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { doc, collection, query, where, getDocs } from "firebase/firestore";
import type { Customer, CropBatch, StorageLocation, StorageArea, CropType } from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { Loader2, User, Phone } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, formatDistanceToNow } from "date-fns";
import { OutflowDialog } from "@/components/outflow-dialog";


export default function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const { firestore, user } = useFirebase();

  const [selectedBatch, setSelectedBatch] = useState<CropBatch | null>(null);
  const [isOutflowDialogOpen, setIsOutflowDialogOpen] = useState(false);
  
  // Document reference for the specific customer
  const customerRef = useMemoFirebase(() =>
    customerId ? doc(firestore, 'customers', customerId) : null,
    [firestore, customerId]
  );
  const { data: customer, isLoading: isLoadingCustomer } = useDoc<Customer>(customerRef);

  // Query for all crop batches for this customer
  const batchesQuery = useMemoFirebase(() => 
    (user && customerId) ? query(collection(firestore, 'cropBatches'), where('customerId', '==', customerId), where('ownerId', '==', user.uid)) : null,
    [firestore, user, customerId]
  );
  const { data: rawBatches, isLoading: isLoadingBatches } = useCollection<CropBatch>(batchesQuery);

  const locationsQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, 'storageLocations'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );
  const { data: locations, isLoading: isLoadingLocations } = useCollection<StorageLocation>(locationsQuery);

  const cropTypesQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, 'cropTypes'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );
  const { data: cropTypes, isLoading: isLoadingCropTypes } = useCollection<CropType>(cropTypesQuery);

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
  
  const handleRowClick = (batch: CropBatch) => {
    setSelectedBatch(batch);
    setIsOutflowDialogOpen(true);
  };

  const isLoading = isLoadingCustomer || isLoadingBatches || isLoadingLocations || isLoadingAreas || isLoadingCropTypes;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <p>Customer not found.</p>
      </div>
    );
  }
  
  return (
    <>
      <PageHeader
        title={customer.name}
        description="A summary of all batches stored by this customer."
      />
      
      <div className="grid gap-6">
        {/* Customer Details Card */}
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <User className="h-6 w-6 text-primary" />
                        <span>Customer Details</span>
                    </CardTitle>
                </div>
                 <div className="pt-2 space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>{customer.mobileNumber}</span>
                    </div>
                </div>
            </CardHeader>
        </Card>

        {/* Batches Section */}
        <Card>
            <CardHeader>
                <CardTitle>Stored Batches</CardTitle>
                <CardDescription>
                    {batches?.length || 0} active batches found for this customer.
                </CardDescription>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                    <TableRow>
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
                        <TableCell colSpan={5} className="h-24 text-center">
                            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                        </TableCell>
                        </TableRow>
                    ) : batches && batches.length > 0 ? batches.map((batch) => (
                        <TableRow key={batch.id} onClick={() => handleRowClick(batch)} className="cursor-pointer">
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
                        <TableCell colSpan={5} className="h-24 text-center">
                            No crop batches found for this customer.
                        </TableCell>
                        </TableRow>
                    )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </div>
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

    