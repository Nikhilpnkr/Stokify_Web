
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";
import { AddBatchDialog } from "@/components/add-batch-dialog";
import { useCollection, useFirebase, useUser, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import type { CropBatch, StorageLocation, CropType } from "@/lib/data";


export default function InventoryPage() {
  const { firestore } = useFirebase();
  const { user } = useUser();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

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
  
  const { data: batches, isLoading: isLoadingBatches } = useCollection<CropBatch>(cropBatchesQuery);
  const { data: locations, isLoading: isLoadingLocations } = useCollection<StorageLocation>(storageLocationsQuery);
  const { data: cropTypes, isLoading: isLoadingCropTypes } = useCollection<CropType>(cropTypesQuery);
  
  const getLocationName = (locationId: string) => {
    return locations?.find(l => l.id === locationId)?.name || 'Unknown';
  }

  const isLoading = isLoadingBatches || isLoadingLocations || isLoadingCropTypes;

  return (
    <>
      <PageHeader
        title="Crop Inflow / Inventory"
        description="A list of all crop batches currently in storage."
        action={
          <Button onClick={() => setIsAddDialogOpen(true)} disabled={!user}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Batch
          </Button>
        }
      />
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Crop Type</TableHead>
                <TableHead className="text-right">Quantity (bags)</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Date Added</TableHead>
                <TableHead>Storage Plan</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              ) : batches && batches.length > 0 ? batches.map((batch) => (
                <TableRow key={batch.id}>
                  <TableCell className="font-medium">{batch.cropType}</TableCell>
                  <TableCell className="text-right">{batch.quantity.toLocaleString()}</TableCell>
                  <TableCell>{getLocationName(batch.storageLocationId)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{format(new Date(batch.dateAdded), "MMM d, yyyy")}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(batch.dateAdded), { addSuffix: true })}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{batch.storageDurationMonths} month{batch.storageDurationMonths > 1 ? 's' : ''}</Badge>
                  </TableCell>
                  <TableCell className="text-right">${batch.storageCost.toLocaleString()}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
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
      />
    </>
  );
}
