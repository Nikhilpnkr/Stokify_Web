"use client";

import { useState } from "react";
import { initialStorageLocations, StorageLocation, initialCropBatches, CropBatch } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { PlusCircle, Warehouse } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AddLocationDialog } from "@/components/add-location-dialog";

export default function LocationsPage() {
  const [locations, setLocations] = useState<StorageLocation[]>(initialStorageLocations);
  const [batches] = useState<CropBatch[]>(initialCropBatches);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const handleAddLocation = (newLocation: StorageLocation) => {
    setLocations((prev) => [newLocation, ...prev]);
  };

  const getUsage = (locationId: string) => {
    const used = batches
      .filter(b => b.locationId === locationId)
      .reduce((acc, b) => acc + b.quantity, 0);
    const capacity = locations.find(l => l.id === locationId)?.capacity || 0;
    return { used, percentage: capacity > 0 ? (used / capacity) * 100 : 0 };
  };

  return (
    <>
      <PageHeader
        title="Storage Locations"
        description="Manage your warehouses, silos, and other storage areas."
        action={
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Location
          </Button>
        }
      />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {locations.map((location) => {
          const { used, percentage } = getUsage(location.id);
          return (
            <Card key={location.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium">{location.name}</CardTitle>
                <Warehouse className="h-6 w-6 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{used.toLocaleString()} / {location.capacity.toLocaleString()} bags</div>
                <p className="text-xs text-muted-foreground">
                  {Math.round(percentage)}% capacity used
                </p>
                <Progress value={percentage} className="mt-4 h-2" />
              </CardContent>
            </Card>
          )
        })}
      </div>
      <AddLocationDialog
        isOpen={isAddDialogOpen}
        setIsOpen={setIsAddDialogOpen}
        onAddLocation={handleAddLocation}
      />
    </>
  );
}
