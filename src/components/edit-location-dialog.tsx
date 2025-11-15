
"use client";

import { useEffect } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { useFirebase, useUser, updateDocumentNonBlocking } from "@/firebase";
import { doc } from "firebase/firestore";
import type { StorageLocation } from "@/lib/data";
import { logAction } from "@/lib/actions";

const formSchema = z.object({
  name: z.string().min(2, "Warehouse name must be at least 2 characters."),
  mobileNumber: z.string().min(10, "Please enter a valid mobile number."),
  address: z.string().min(5, "Please enter a valid address."),
  capacity: z.coerce.number().min(1, "Capacity must be at least 1."),
});

type EditLocationDialogProps = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  location: StorageLocation;
};

export function EditLocationDialog({ isOpen, setIsOpen, location }: EditLocationDialogProps) {
  const { toast } = useToast();
  const { firestore } = useFirebase();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: location.name,
      mobileNumber: location.mobileNumber,
      address: location.address,
      capacity: location.capacity,
    },
  });

  useEffect(() => {
    if (location) {
      form.reset({
        name: location.name,
        mobileNumber: location.mobileNumber,
        address: location.address,
        capacity: location.capacity,
      });
    }
  }, [location, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !location) return;

    const locationRef = doc(firestore, "storageLocations", location.id);
    
    const updatedData = {
      name: values.name,
      capacity: values.capacity,
      mobileNumber: values.mobileNumber,
      address: values.address,
    };

    updateDocumentNonBlocking(locationRef, updatedData);
    
    await logAction("UPDATE_LOCATION", {
        entityType: "StorageLocation",
        entityId: location.id,
        details: `Updated location: ${location.name}`
    });

    toast({
        title: "Success!",
        description: `Location "${values.name}" has been updated.`,
    });
    setIsOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Storage Location</DialogTitle>
          <DialogDescription>
            Update the details for this storage area.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Warehouse Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Warehouse B, Silo-03" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="mobileNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Warehouse Owner No.</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter mobile number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Warehouse Address</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter full address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Capacity (in bags)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
