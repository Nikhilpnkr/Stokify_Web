
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, DollarSign, Wheat } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";
import { AddBatchDialog } from "@/components/add-batch-dialog";
import { useCollection, useFirebase, useUser, useMemoFirebase, addDocumentNonBlocking } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import type { CropBatch, StorageLocation, CropType } from "@/lib/data";
import { STORAGE_RATES } from "@/lib/data";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";


const cropTypeFormSchema = z.object({
  name: z.string().min(2, "Crop name must be at least 2 characters."),
});

function CropTypesManager() {
  const { firestore, user } = useFirebase();
  const { toast } = useToast();
  
  const cropTypesQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, 'cropTypes'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );
  const { data: cropTypes, isLoading: isLoadingCropTypes } = useCollection<CropType>(cropTypesQuery);

  const form = useForm<z.infer<typeof cropTypeFormSchema>>({
    resolver: zodResolver(cropTypeFormSchema),
    defaultValues: {
      name: "",
    },
  });

  function onSubmit(values: z.infer<typeof cropTypeFormSchema>) {
    if (!user) return;

    const cropTypesCol = collection(firestore, "cropTypes");
    const newDocRef = doc(cropTypesCol);
    
    const newCropType = {
      id: newDocRef.id,
      name: values.name,
      ownerId: user.uid,
    };

    addDocumentNonBlocking(cropTypesCol, newCropType);
    
    toast({
        title: "Crop Type Added",
        description: `"${values.name}" has been added to your crop types.`,
    });
    form.reset();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage Crop Types</CardTitle>
        <CardDescription>Add or view your custom crop types.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-start gap-4 mb-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="flex-grow">
                  <FormLabel className="sr-only">Crop Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Maize, Soyabean" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              Add Crop
            </Button>
          </form>
        </Form>
        <div className="border rounded-md p-4 min-h-[150px]">
          <h4 className="font-semibold mb-2">Your Crop Types</h4>
          {isLoadingCropTypes ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : cropTypes && cropTypes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {cropTypes.map(ct => <Badge key={ct.id} variant="secondary">{ct.name}</Badge>)}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center pt-8">You haven't added any crop types yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


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
  
  const { data: batches, isLoading: isLoadingBatches } = useCollection<CropBatch>(cropBatchesQuery);
  const { data: locations, isLoading: isLoadingLocations } = useCollection<StorageLocation>(storageLocationsQuery);
  
  const getLocationName = (locationId: string) => {
    return locations?.find(l => l.id === locationId)?.name || 'Unknown';
  }

  const isLoading = isLoadingBatches || isLoadingLocations;

  return (
    <>
      <PageHeader
        title="Current Inventory"
        description="A list of all crop batches currently in storage."
        action={
          <Button onClick={() => setIsAddDialogOpen(true)} disabled={!user}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Batch
          </Button>
        }
      />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
        <Card>
            <CardHeader>
                <CardTitle>Storage Rates</CardTitle>
                <CardDescription>Per bag for specified durations.</CardDescription>
            </CardHeader>
            <CardContent>
                <ul className="space-y-2 text-sm">
                    <li className="flex justify-between"><span>1 Month:</span> <strong>${STORAGE_RATES[1]}</strong></li>
                    <li className="flex justify-between"><span>6 Months:</span> <strong>${STORAGE_RATES[6]}</strong></li>
                    <li className="flex justify-between"><span>12 Months:</span> <strong>${STORAGE_RATES[12]}</strong></li>
                </ul>
            </CardContent>
        </Card>
        <div className="lg:col-span-2">
          <CropTypesManager />
        </div>
      </div>
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
      />
    </>
  );
}
