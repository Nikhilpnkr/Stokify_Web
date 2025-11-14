
"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useFirebase, deleteDocumentNonBlocking } from "@/firebase";
import { doc } from "firebase/firestore";
import type { CropBatch, CropType } from "@/lib/data";
import { differenceInMonths, format } from "date-fns";
import { Loader2 } from "lucide-react";

type OutflowDialogProps = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  batch: CropBatch | null;
  cropType: CropType | undefined;
};

export function OutflowDialog({ isOpen, setIsOpen, batch, cropType }: OutflowDialogProps) {
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const [isProcessing, setIsProcessing] = useState(false);

    const { totalMonths, finalCost } = useMemo(() => {
        if (!batch || !cropType) {
          return { totalMonths: 0, finalCost: 0 };
        }
    
        const startDate = new Date(batch.dateAdded);
        const endDate = new Date();
        const totalMonths = differenceInMonths(endDate, startDate);
    
        let remainingMonths = totalMonths;
        let cost = 0;
    
        const yearlyRate = cropType.rates['12'];
        const halfYearlyRate = cropType.rates['6'];
        const monthlyRate = cropType.rates['1'];
    
        // Calculate based on your logic
        if (remainingMonths >= 12) {
          const years = Math.floor(remainingMonths / 12);
          cost += years * yearlyRate;
          remainingMonths %= 12;
        }
    
        if (remainingMonths >= 6) {
          cost += halfYearlyRate;
          remainingMonths = 0; // After 6 months, we don't consider monthly
        }
        
        if (remainingMonths > 0 && totalMonths < 6) {
             cost += remainingMonths * monthlyRate;
        } else if (remainingMonths > 0) {
            // If more than 5 months have passed, round up to 6 months rate
            cost += halfYearlyRate;
        }

        // If it's the first month, ensure at least one month's charge
        if (totalMonths < 1) {
            cost = monthlyRate;
        }
    
        const finalCost = cost * batch.quantity;

        return { totalMonths, finalCost };

    }, [batch, cropType]);

    async function handleOutflow() {
        if (!firestore || !batch) return;
        setIsProcessing(true);

        const batchRef = doc(firestore, "cropBatches", batch.id);
        deleteDocumentNonBlocking(batchRef);
        
        toast({
            title: "Outflow Successful!",
            description: `Batch for ${batch.customerName} has been removed from inventory. Final bill: $${finalCost.toLocaleString()}`,
        });

        setIsProcessing(false);
        setIsOpen(false);
    }

    if (!batch) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Process Outflow & Bill</DialogTitle>
          <DialogDescription>
            Confirm the removal of this batch and generate the final bill.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <p className="font-medium text-muted-foreground">Customer</p>
                    <p className="font-semibold">{batch.customerName}</p>
                </div>
                <div>
                    <p className="font-medium text-muted-foreground">Crop Type</p>
                    <p className="font-semibold">{batch.cropType}</p>
                </div>
                 <div>
                    <p className="font-medium text-muted-foreground">Quantity</p>
                    <p className="font-semibold">{batch.quantity.toLocaleString()} bags</p>
                </div>
                <div>
                    <p className="font-medium text-muted-foreground">Date Added</p>
                    <p className="font-semibold">{format(new Date(batch.dateAdded), "MMM d, yyyy")}</p>
                </div>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
                <div className="flex justify-between items-baseline">
                    <p className="text-muted-foreground">Total Storage Duration:</p>
                    <p className="font-semibold">{totalMonths} months</p>
                </div>
                 <div className="flex justify-between items-center mt-2">
                    <p className="text-lg font-bold">Final Bill:</p>
                    <p className="text-2xl font-bold text-primary">${finalCost.toLocaleString()}</p>
                </div>
            </div>
             <p className="text-xs text-muted-foreground text-center">
              This action will permanently remove the crop batch from your inventory.
            </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isProcessing}>Cancel</Button>
          <Button onClick={handleOutflow} disabled={isProcessing} className="bg-primary hover:bg-primary/90">
             {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Outflow & Settle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

