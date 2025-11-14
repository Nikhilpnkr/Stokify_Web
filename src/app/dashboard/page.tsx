"use client";

import { useState } from "react";
import { initialCropBatches, initialStorageLocations, CropBatch, StorageLocation } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";
import { AddBatchDialog } from "@/components/add-batch-dialog";

export default function InventoryPage() {
  const [batches, setBatches] = useState<CropBatch[]>(initialCropBatches);
  const [locations] = useState<StorageLocation[]>(initialStorageLocations);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const handleAddBatch = (newBatch: CropBatch) => {
    setBatches((prev) => [newBatch, ...prev]);
  };

  const getLocationName = (locationId: string) => {
    return locations.find(l => l.id === locationId)?.name || 'Unknown';
  }

  return (
    <>
      <PageHeader
        title="Current Inventory"
        description="A list of all crop batches currently in storage."
        action={
          <Button onClick={() => setIsAddDialogOpen(true)}>
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
              {batches.length > 0 ? batches.map((batch) => (
                <TableRow key={batch.id}>
                  <TableCell className="font-medium">{batch.cropType}</TableCell>
                  <TableCell className="text-right">{batch.quantity.toLocaleString()}</TableCell>
                  <TableCell>{getLocationName(batch.locationId)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{format(new Date(batch.dateAdded), "MMM d, yyyy")}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(batch.dateAdded), { addSuffix: true })}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{batch.storageDuration} month{batch.storageDuration > 1 ? 's' : ''}</Badge>
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
        onAddBatch={handleAddBatch}
        locations={locations}
      />
    </>
  );
}
