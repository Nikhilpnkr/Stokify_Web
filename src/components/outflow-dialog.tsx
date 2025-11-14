
"use client";

import { useState, useMemo, useEffect } from "react";
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
import { useFirebase, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { doc } from "firebase/firestore";
import type { CropBatch, CropType } from "@/lib/data";
import { differenceInMonths, format } from "date-fns";
import { Loader2 } from "lucide-react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

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
    
    // For now, partial withdrawal from multi-area batch is complex.
    // Defaulting to full withdrawal.
    const totalQuantity = useMemo(() => {
        if (!batch) return 0;
        return batch.areaAllocations.reduce((sum, alloc) => sum + alloc.quantity, 0);
    }, [batch]);

    useEffect(() => {
        // Reset state on open/close
    }, [batch, isOpen]);

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
    
        if (remainingMonths >= 12) {
          const years = Math.floor(remainingMonths / 12);
          cost += years * yearlyRate;
          remainingMonths %= 12;
        }
    
        if (remainingMonths >= 6) {
          cost += halfYearlyRate;
          remainingMonths = 0; 
        }
        
        if (remainingMonths > 0 && totalMonths < 6) {
             cost += remainingMonths * monthlyRate;
        } else if (remainingMonths > 0) {
            cost += halfYearlyRate;
        }

        if (totalMonths < 1) {
            cost = monthlyRate;
        }
    
        const finalCost = cost * totalQuantity;

        return { totalMonths, finalCost };

    }, [batch, cropType, totalQuantity]);


    async function handleOutflow() {
        if (!firestore || !batch) return;
        
        setIsProcessing(true);

        const batchRef = doc(firestore, "cropBatches", batch.id);

        // For now, always full outflow for multi-area batches
        deleteDocumentNonBlocking(batchRef);
        toast({
            title: "Full Outflow Successful!",
            description: `Batch for ${batch.customerName} removed. Final bill generated: $${finalCost.toLocaleString()}`,
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
            Confirm the removal of this batch and generate the final bill. Partial withdrawal is not supported for multi-area batches yet.
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
                    <p className="font-medium text-muted-foreground">Total Quantity</p>
                    <p className="font-semibold">{totalQuantity.toLocaleString()} bags</p>
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
              This action will permanently remove the entire batch from your inventory.
            </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isProcessing}>Cancel</Button>
          <Button onClick={handleOutflow} disabled={isProcessing} className="bg-primary hover:bg-primary/90">
             {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Full Outflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
