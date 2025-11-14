"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle, Warehouse, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AddLocationDialog } from "@/components/add-location-dialog";
import { useCollection, useFirebase, useUser, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import type { StorageLocation, CropBatch } from "@/lib/data";

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 p-12 text-center h-full">
      <Warehouse className="mx-auto h-12 w-12 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-semibold text-foreground">No Locations Found</h3>
      <p className="mt-2 text-sm text-muted-foreground">Get started by adding a new storage location.</p>
    </div>
  )
}

export default function LocationsPage() {
  const { firestore } = useFirebase();
  const { user } = useUser();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const locationsQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, 'storageLocations'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );
  const cropBatchesQuery = useMemoFirebase(() =>
    user ? query(collection(firestore, 'cropBatches'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );

  const { data: locations, isLoading: isLoadingLocations } = useCollection<StorageLocation>(locationsQuery);
  const { data: batches, isLoading: isLoadingBatches } = useCollection<CropBatch>(cropBatchesQuery);

  const locationsWithUsage = useMemo(() => {
    if (!locations || !batches) return [];
    return locations.map(location => {
      const used = batches
        .filter(b => b.storageLocationId === location.id)
        .reduce((acc, b) => acc + b.quantity, 0);
      const percentage = location.capacity > 0 ? (used / location.capacity) * 100 : 0;
      return { ...location, used, percentage };
    });
  }, [locations, batches]);

  const isLoading = isLoadingLocations || isLoadingBatches;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Storage Locations"
        description="Manage your warehouses, silos, and other storage areas."
        action={
          <Button onClick={() => setIsAddDialogOpen(true)} disabled={!user}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Location
          </Button>
        }
      />
      
      {!user ? (
         <div className="flex items-center justify-center h-64">
           <p className="text-muted-foreground">Please sign in to manage locations.</p>
         </div>
      ) : locationsWithUsage.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {locationsWithUsage.map((location) => (
            <Card key={location.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium">{location.name}</CardTitle>
                <Warehouse className="h-6 w-6 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{location.used.toLocaleString()} / {location.capacity.toLocaleString()} bags</div>
                <p className="text-xs text-muted-foreground">
                  {Math.round(location.percentage)}% capacity used
                </p>
                <Progress value={location.percentage} className="mt-4 h-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState />
      )}

      <AddLocationDialog
        isOpen={isAddDialogOpen}
        setIsOpen={setIsAddDialogOpen}
      />
    </>
  );
}
