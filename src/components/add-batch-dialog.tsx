
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CropType, StorageLocation, StorageArea, Customer } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { useFirebase, useUser, setDocumentNonBlocking, addDocumentNonBlocking, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, getDocs, doc } from "firebase/firestore";

const formSchema = z.object({
  customerName: z.string().min(2, "Customer name is required."),
  customerMobile: z.string().min(10, "A valid mobile number is required."),
  cropTypeId: z.string().min(1, "Please select a crop type."),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
  locationId: z.string().min(1, "Please select a storage location."),
  areaId: z.string().min(1, "Please select an area."),
});

type AddBatchDialogProps = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  locations: StorageLocation[];
  cropTypes: CropType[];
  customers: Customer[];
};

export function AddBatchDialog({ isOpen, setIsOpen, locations, cropTypes, customers }: AddBatchDialogProps) {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { user } = useUser();
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: 1,
    },
  });

  const areasQuery = useMemoFirebase(() =>
    selectedLocationId ? collection(firestore, "storageLocations", selectedLocationId, "areas") : null,
    [firestore, selectedLocationId]
  );
  const { data: areas, isLoading: isLoadingAreas } = useCollection<StorageArea>(areasQuery);


  useEffect(() => {
    form.reset({
        quantity: 1,
        customerName: "",
        customerMobile: "",
        cropTypeId: undefined,
        locationId: undefined,
        areaId: undefined,
    });
    setSelectedLocationId(null);
  }, [isOpen, form]);


  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user || !firestore) {
      toast({ variant: "destructive", title: "Authentication Error", description: "You must be signed in." });
      return;
    }

    const selectedCropType = cropTypes.find(ct => ct.id === values.cropTypeId);
    if (!selectedCropType) {
        toast({ variant: "destructive", title: "Error", description: "Selected crop type not found." });
        return;
    }

    let customerId = "";
    let customerName = values.customerName;

    // Check if customer exists, otherwise create a new one
    const customerQuery = query(collection(firestore, 'customers'), where('mobileNumber', '==', values.customerMobile), where('ownerId', '==', user.uid));
    const querySnapshot = await getDocs(customerQuery);
    
    if (querySnapshot.empty) {
        // Create new customer
        const newCustomerRef = doc(collection(firestore, "customers"));
        const newCustomer = {
            id: newCustomerRef.id,
            name: values.customerName,
            mobileNumber: values.customerMobile,
            ownerId: user.uid
        };
        setDocumentNonBlocking(newCustomerRef, newCustomer, { merge: false });
        customerId = newCustomer.id;
    } else {
        // Customer exists
        const existingCustomer = querySnapshot.docs[0];
        customerId = existingCustomer.id;
        customerName = existingCustomer.data().name; // Use existing name
    }

    const newBatch = {
      cropType: selectedCropType.name,
      quantity: values.quantity,
      ratePerMonth: selectedCropType.ratePerMonth,
      storageLocationId: values.locationId,
      storageAreaId: values.areaId,
      dateAdded: new Date().toISOString(),
      ownerId: user.uid,
      customerId,
      customerName,
    };
    
    const cropBatchesCol = collection(firestore, "cropBatches");
    addDocumentNonBlocking(cropBatchesCol, newBatch);

    toast({
      title: "Success!",
      description: `New batch for ${customerName} has been added.`,
    });
    setIsOpen(false);
    form.reset();
  }

  const handleLocationChange = (locationId: string) => {
    form.setValue("locationId", locationId);
    form.resetField("areaId");
    setSelectedLocationId(locationId);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Crop Batch</DialogTitle>
          <DialogDescription>
            Fill in the details below to add a new batch to your inventory.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
             <FormField
              control={form.control}
              name="customerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter customer's full name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="customerMobile"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Mobile Number</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter customer's mobile" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cropTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Crop Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a crop type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {cropTypes.map((ct) => (
                        <SelectItem key={ct.id} value={ct.id}>
                          {ct.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity (in bags)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="locationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Storage Location</FormLabel>
                  <Select onValueChange={handleLocationChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a location" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="areaId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Storage Area</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!selectedLocationId || isLoadingAreas}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingAreas ? "Loading areas..." : "Select an area"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {areas?.map((area) => (
                        <SelectItem key={area.id} value={area.id}>
                          {area.name} (Capacity: {area.capacity.toLocaleString()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Add Batch</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
