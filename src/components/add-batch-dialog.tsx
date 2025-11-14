"use client";

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
import type { CropBatch, StorageLocation } from "@/lib/data";
import { STORAGE_RATES } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { useFirebase, useUser, addDocumentNonBlocking } from "@/firebase";
import { collection } from "firebase/firestore";

const formSchema = z.object({
  cropType: z.string().min(2, "Crop type must be at least 2 characters."),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
  locationId: z.string().min(1, "Please select a storage location."),
  storageDuration: z.enum(["1", "6", "12"]),
});

type AddBatchDialogProps = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  locations: StorageLocation[];
};

export function AddBatchDialog({ isOpen, setIsOpen, locations }: AddBatchDialogProps) {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { user } = useUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      cropType: "",
      quantity: 1,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "You must be signed in to add a batch."
      });
      return;
    }

    const duration = parseInt(values.storageDuration) as keyof typeof STORAGE_RATES;
    const storageCost = STORAGE_RATES[duration];
    const location = locations.find(l => l.id === values.locationId);
    
    if (!location) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Selected location not found."
        });
        return;
    }

    const currentUsage = 0; // Simplified for now. A real app would query this.
    if(values.quantity + currentUsage > location.capacity) {
        toast({
            variant: "destructive",
            title: "Capacity Exceeded",
            description: `Adding this batch exceeds the capacity of ${location.name}.`,
        });
        return;
    }

    const newBatch = {
      cropType: values.cropType,
      quantity: values.quantity,
      storageDurationMonths: duration,
      storageCost,
      storageLocationId: values.locationId,
      dateAdded: new Date().toISOString(),
      ownerId: user.uid,
    };
    
    const cropBatchesCol = collection(firestore, "cropBatches");
    addDocumentNonBlocking(cropBatchesCol, newBatch);

    toast({
      title: "Success!",
      description: `New batch of ${values.cropType} has been added.`,
    });
    setIsOpen(false);
    form.reset();
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
              name="cropType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Crop Type</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Wheat, Corn" {...field} />
                  </FormControl>
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a location" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name} (Capacity: {loc.capacity.toLocaleString()})
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
              name="storageDuration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Storage Duration</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a duration" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1">1 Month</SelectItem>
                      <SelectItem value="6">6 Months</SelectItem>
                      <SelectItem value="12">1 Year</SelectItem>
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
