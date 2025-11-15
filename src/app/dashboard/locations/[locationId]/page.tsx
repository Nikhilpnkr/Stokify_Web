
"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useFirebase, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { doc, collection, query, writeBatch, getDocs } from "firebase/firestore";
import type { StorageLocation, StorageArea, CropBatch } from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { Loader2, Warehouse, MapPin, Phone, Trash2, Layers, PlusCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AddAreaDialog } from "@/components/add-area-dialog";
import { BulkAddAreasDialog } from "@/components/bulk-add-areas-dialog";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";

export default function LocationDetailPage() {
  const { locationId } = useParams<{ locationId: string }>();
  const { firestore, user } = useFirebase();
  const { toast } = useToast();

  const [isAddAreaOpen, setIsAddAreaOpen] = useState(false);
  const [isBulkAddAreaOpen, setIsBulkAddAreaOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [areaToDelete, setAreaToDelete] = useState<StorageArea | null>(null);

  const locationRef = useMemoFirebase(() =>
    locationId ? doc(firestore, 'storageLocations', locationId) : null,
    [firestore, locationId]
  );
  const { data: location, isLoading: isLoadingLocation } = useDoc<StorageLocation>(locationRef);

  const areasQuery = useMemoFirebase(() =>
    locationId ? query(collection(firestore, 'storageLocations', locationId, 'areas')) : null,
    [firestore, locationId]
  );
  const { data: areas, isLoading: isLoadingAreas } = useCollection<StorageArea>(areasQuery);

  const batchesQuery = useMemoFirebase(() => 
    user && locationId ? query(collection(firestore, 'cropBatches'), where('storageLocationId', '==', locationId), where('ownerId', '==', user.uid)) : null,
    [user, firestore, locationId]
  );
  const { data: batches, isLoading: isLoadingBatches } = useCollection<CropBatch>(batchesQuery);

  const areasWithUsage = useMemo(() => {
    if (!areas || !batches) return [];
    return areas.map(area => {
      const used = batches
        .flatMap(b => b.areaAllocations || [])
        .filter(alloc => alloc.areaId === area.id)
        .reduce((acc, alloc) => acc + alloc.quantity, 0);
      const percentage = area.capacity > 0 ? (used / area.capacity) * 100 : 0;
      return { ...area, used, percentage };
    });
  }, [areas, batches]);
  
  const isLoading = isLoadingLocation || isLoadingAreas || isLoadingBatches;

  const handleDeleteConfirmation = (area: StorageArea) => {
    setAreaToDelete(area);
    setIsDeleteDialogOpen(true);
  }

  const executeDelete = async () => {
    if (!areaToDelete || !locationId || !firestore) return;

    const areaRef = doc(firestore, "storageLocations", locationId, "areas", areaToDelete.id);
    deleteDocumentNonBlocking(areaRef);

    toast({
      title: "Area Deleted",
      description: `"${areaToDelete.name}" has been removed.`,
    });

    setIsDeleteDialogOpen(false);
    setAreaToDelete(null);
  }
  
  const executeDeleteAll = async () => {
    if (!locationId || !firestore || !areasQuery) return;
    
    try {
        const areasSnapshot = await getDocs(areasQuery);
        if (areasSnapshot.empty) return;
        
        const batch = writeBatch(firestore);
        areasSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        toast({
            title: "All Areas Deleted",
            description: `All storage areas in "${location?.name}" have been removed.`,
        });
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Could not delete all areas. Please try again.",
        });
        console.error("Error deleting all areas: ", error);
    } finally {
        setIsDeleteAllOpen(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!location) {
    return (
      <div className="text-center py-12">
        <p>Location not found.</p>
      </div>
    );
  }
  
  const totalUsed = areasWithUsage.reduce((acc, area) => acc + area.used, 0);
  const totalCapacity = areasWithUsage.reduce((acc, area) => acc + area.capacity, 0);
  const overallPercentage = totalCapacity > 0 ? (totalUsed / totalCapacity) * 100 : 0;

  return (
    <>
      <PageHeader
        title={location.name}
        description="Manage the specific storage areas within this location."
        action={
            <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsBulkAddAreaOpen(true)}>
                    <Layers className="mr-2 h-4 w-4" />
                    Bulk Add Areas
                </Button>
                <Button onClick={() => setIsAddAreaOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Single Area
                </Button>
            </div>
        }
      />
      
      <div className="grid gap-6">
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <Warehouse className="h-6 w-6 text-primary" />
                        <span>Warehouse Summary</span>
                    </CardTitle>
                </div>
                 <div className="pt-2 space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{location.address}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>{location.mobileNumber}</span>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{totalUsed.toLocaleString()} / {totalCapacity.toLocaleString()} bags</div>
                <p className="text-xs text-muted-foreground">
                {Math.round(overallPercentage)}% of total capacity used
                </p>
                <Progress value={overallPercentage} className="mt-4 h-2" />
            </CardContent>
        </Card>

        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>Storage Areas</CardTitle>
                    <CardDescription>
                        {areas?.length || 0} areas defined in this location.
                    </CardDescription>
                </div>
                 {areas && areas.length > 0 && (
                    <Button variant="destructive" size="sm" onClick={() => setIsDeleteAllOpen(true)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove All
                    </Button>
                 )}
            </CardHeader>
            <CardContent>
                 {isLoadingAreas ? (
                    <div className="flex justify-center items-center h-48">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    </div>
                 ) : areasWithUsage.length > 0 ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {areasWithUsage.map(area => (
                            <Card key={area.id} className="bg-muted/30">
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-lg">{area.name}</CardTitle>
                                         <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteConfirmation(area)}>
                                            <Trash2 className="h-4 w-4" />
                                            <span className="sr-only">Delete {area.name}</span>
                                        </Button>
                                    </div>
                                    <CardDescription>Capacity: {area.capacity.toLocaleString()} bags</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-xl font-semibold">{area.used.toLocaleString()} bags used</div>
                                    <p className="text-xs text-muted-foreground">{area.percentage.toFixed(1)}% used</p>
                                    <Progress value={area.percentage} className="mt-2 h-1.5" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 p-12 text-center h-full">
                        <p className="text-sm text-muted-foreground">No storage areas have been added to this location yet.</p>
                         <Button variant="outline" size="sm" className="mt-4" onClick={() => setIsAddAreaOpen(true)}>Add First Area</Button>
                    </div>
                )}
            </CardContent>
        </Card>
      </div>

      <AddAreaDialog
        isOpen={isAddAreaOpen}
        setIsOpen={setIsAddAreaOpen}
        locationId={locationId}
      />
      <BulkAddAreasDialog
        isOpen={isBulkAddAreaOpen}
        setIsOpen={setIsBulkAddAreaOpen}
        locationId={locationId}
       />
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the area "{areaToDelete?.name}". All batch data associated with this area might be orphaned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className="bg-destructive hover:bg-destructive/90">
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteAllOpen} onOpenChange={setIsDeleteAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all areas?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete all {areas?.length || 0} areas in this location.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDeleteAll} className="bg-destructive hover:bg-destructive/90">
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
