
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
import { logAction } from "@/lib/actions";

const formSchema = z.object({
  name: z.string().min(2, "Area name must be at least 2 characters."),
  capacity: z.coerce.number().min(1, "Capacity must be at least 1."),
});

type AddAreaDialogProps = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  locationId: string;
};

export function AddAreaDialog({ isOpen, setIsOpen, locationId }: AddAreaDialogProps) {
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const { user } = useUser();

    const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      capacity: 0,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user || !locationId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be signed in and provide a location to add an area."
      });
      return;
    }

    const areasColRef = collection(firestore, "storageLocations", locationId, "areas");
    const newDocRef = doc(areasColRef);
    
    const newArea = {
      id: newDocRef.id,
      name: values.name,
      capacity: values.capacity,
      storageLocationId: locationId,
      ownerId: user.uid,
    };

    setDocumentNonBlocking(newDocRef, newArea, { merge: false });
    
    await logAction("CREATE_AREA", {
        entityType: "StorageArea",
        entityId: newArea.id,
        details: `Created area "${newArea.name}" in location ${locationId}`
    });
    
    toast({
        title: "Success!",
        description: `New area "${values.name}" has been created.`,
    });
    setIsOpen(false);
    form.reset();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) {
            form.reset();
        }
        setIsOpen(open);
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Storage Area</DialogTitle>
          <DialogDescription>
            Define a new area within this warehouse and set its capacity.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Area Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Section A, Bin 5" {...field} />
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
                  <FormLabel>Area Capacity (in bags)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 1000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Create Area</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
