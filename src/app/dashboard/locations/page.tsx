
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PlusCircle, Warehouse, Loader2, Phone, MapPin, Edit } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AddLocationDialog } from "@/components/add-location-dialog";
import { EditLocationDialog } from "@/components/edit-location-dialog";
import { useCollection, useFirebase, useUser, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import type { StorageLocation, CropBatch } from "@/lib/data";

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 p-12 text-center h-full">
      <Warehouse className="mx-auto h-12 w-12 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-semibold text-foreground">No Locations Found</h3>
      <p className="mt-2 text-sm text-muted-foreground">Get started by adding a new storage location.</p>
      <Button onClick={onAdd} className="mt-6">
        <PlusCircle className="mr-2 h-4 w-4" />
        Add New Location
      </Button>
    </div>
  )
}

export default function LocationsPage() {
  const { firestore } = useFirebase();
  const { user } = useUser();
  const router = useRouter();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<StorageLocation | null>(null);

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

  const handleEditClick = (e: React.MouseEvent, location: StorageLocation) => {
    e.stopPropagation();
    setSelectedLocation(location);
    setIsEditDialogOpen(true);
  }
  
  const handleCardClick = (locationId: string) => {
    router.push(`/dashboard/locations/${locationId}`);
  };


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
      
      {locationsWithUsage.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {locationsWithUsage.map((location) => (
            <Card 
              key={location.id} 
              className="flex flex-col cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleCardClick(location.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg font-medium">{location.name}</CardTitle>
                  <Warehouse className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="text-sm text-muted-foreground space-y-2 pt-2">
                  {location.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{location.address}</span>
                    </div>
                  )}
                  {location.mobileNumber && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{location.mobileNumber}</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col justify-end">
                <div>
                    <div className="text-2xl font-bold">{location.used.toLocaleString()} / {location.capacity.toLocaleString()} bags</div>
                    <p className="text-xs text-muted-foreground">
                    {Math.round(location.percentage)}% capacity used
                    </p>
                    <Progress value={location.percentage} className="mt-4 h-2" />
                </div>
              </CardContent>
              <CardFooter>
                 <Button variant="outline" size="sm" className="w-full" onClick={(e) => handleEditClick(e, location)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Location
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState onAdd={() => setIsAddDialogOpen(true)} />
      )}

      <AddLocationDialog
        isOpen={isAddDialogOpen}
        setIsOpen={setIsAddDialogOpen}
      />
      {selectedLocation && (
        <EditLocationDialog
          isOpen={isEditDialogOpen}
          setIsOpen={setIsEditDialogOpen}
          location={selectedLocation}
        />
      )}
    </>
  );
}
