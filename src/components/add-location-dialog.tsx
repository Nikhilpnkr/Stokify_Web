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
import { useToast } from "@/hooks/use-toast";
import { useFirebase, useUser, setDocumentNonBlocking } from "@/firebase";
import { doc, collection } from "firebase/firestore";

const formSchema = z.object({
  name: z.string().min(2, "Warehouse name must be at least 2 characters."),
  mobileNumber: z.string().min(10, "Please enter a valid mobile number."),
  address: z.string().min(5, "Please enter a valid address."),
  capacity: z.coerce.number().min(1, "Capacity must be at least 1."),
});

type AddLocationDialogProps = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
};

export function AddLocationDialog({ isOpen, setIsOpen }: AddLocationDialogProps) {
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const { user } = useUser();

    const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      mobileNumber: "",
      address: "",
      capacity: 1000,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "You must be signed in to add a location."
      });
      return;
    }

    const storageLocationsCol = collection(firestore, "storageLocations");
    const newDocRef = doc(storageLocationsCol);
    
    const newLocation = {
      id: newDocRef.id,
      name: values.name,
      capacity: values.capacity,
      ownerId: user.uid,
      mobileNumber: values.mobileNumber,
      address: values.address,
    };

    setDocumentNonBlocking(newDocRef, newLocation, { merge: false });
    
    toast({
        title: "Success!",
        description: `New location "${values.name}" has been created.`,
    });
    setIsOpen(false);
    form.reset();
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Storage Location</DialogTitle>
          <DialogDescription>
            Create a new storage area and define its capacity.
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
              <Button type="submit">Create Location</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
