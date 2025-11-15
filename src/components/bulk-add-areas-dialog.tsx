
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
import { useFirebase, useUser } from "@/firebase";
import { collection, doc, writeBatch } from "firebase/firestore";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  prefixes: z.string().min(1, "Please enter at least one prefix."),
  startNumber: z.coerce.number().min(0, "Start number must be non-negative."),
  endNumber: z.coerce.number().min(0, "End number must be non-negative."),
  capacity: z.coerce.number().min(1, "Capacity must be at least 1."),
}).refine(data => data.endNumber >= data.startNumber, {
    message: "End number must be greater than or equal to start number.",
    path: ["endNumber"],
});

type BulkAddAreasDialogProps = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  locationId: string;
};

export function BulkAddAreasDialog({ isOpen, setIsOpen, locationId }: BulkAddAreasDialogProps) {
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const { user } = useUser();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            prefixes: "a,b,c,d",
            startNumber: 1,
            endNumber: 4,
            capacity: 1000,
        },
    });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user || !locationId || !firestore) {
      toast({ variant: "destructive", title: "Error", description: "Invalid session. Please reload." });
      return;
    }

    try {
        const batch = writeBatch(firestore);
        const areasColRef = collection(firestore, "storageLocations", locationId, "areas");
        const prefixes = values.prefixes.split(',').map(p => p.trim()).filter(Boolean);
        let areaCount = 0;

        for (const prefix of prefixes) {
            for (let i = values.startNumber; i <= values.endNumber; i++) {
                const areaName = `${prefix}${i}`;
                const newDocRef = doc(areasColRef);
                const newArea = {
                    id: newDocRef.id,
                    name: areaName,
                    capacity: values.capacity,
                    storageLocationId: locationId,
                    ownerId: user.uid,
                };
                batch.set(newDocRef, newArea);
                areaCount++;
            }
        }
        
        await batch.commit();

        toast({
            title: "Success!",
            description: `${areaCount} new areas have been created in a batch.`,
        });
        setIsOpen(false);
        form.reset();

    } catch (error) {
        console.error("Error creating batch areas: ", error);
        toast({
            variant: "destructive",
            title: "Batch creation failed",
            description: "Could not create new areas. Please try again.",
        });
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Bulk Add Storage Areas</DialogTitle>
          <DialogDescription>
            Generate multiple areas at once using a prefix and number range.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="prefixes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Row Prefixes</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., a,b,c" {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Enter comma-separated prefixes.</p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
                 <FormField
                  control={form.control}
                  name="startNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Number</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="endNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Number</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
             <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacity for Each Area (bags)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Areas
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
