
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
import type { CropBatch, CropType, AreaAllocation } from "@/lib/data";
import { differenceInMonths, format } from "date-fns";
import { Loader2 } from "lucide-react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { generateInvoicePdf } from "@/lib/pdf";
import type { InvoiceData } from "@/components/invoice";

type OutflowDialogProps = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  batch: CropBatch | null;
  cropType: CropType | undefined;
};

export function OutflowDialog({ isOpen, setIsOpen, batch, cropType }: OutflowDialogProps) {
    const { toast } = useToast();
    const { firestore, user } = useFirebase();
    const [isProcessing, setIsProcessing] = useState(false);
    const [withdrawQuantity, setWithdrawQuantity] = useState(0);
    
    const totalQuantity = useMemo(() => {
        if (!batch) return 0;
        return batch.areaAllocations.reduce((sum, alloc) => sum + alloc.quantity, 0);
    }, [batch]);

    useEffect(() => {
        if (isOpen && batch) {
            setWithdrawQuantity(totalQuantity);
        } else if (!isOpen) {
            // Reset state when dialog closes
            setIsProcessing(false);
            setWithdrawQuantity(0);
        }
    }, [isOpen, batch, totalQuantity]);

    const { totalMonths, finalCost, costPerBag } = useMemo(() => {
        if (!batch || !cropType || withdrawQuantity <= 0) {
          return { totalMonths: 0, finalCost: 0, costPerBag: 0 };
        }
    
        const startDate = new Date(batch.dateAdded);
        const endDate = new Date();
        let totalMonths = differenceInMonths(endDate, startDate);
        // If it's less than a month, count as 1 month for billing.
        if (totalMonths < 1 && startDate.getTime() < endDate.getTime()) {
            totalMonths = 1;
        }
        if (totalMonths <= 0) totalMonths = 1;


        let remainingMonths = totalMonths;
        let costPerBag = 0;
    
        const yearlyRate = cropType.rates['12'];
        const halfYearlyRate = cropType.rates['6'];
        const monthlyRate = cropType.rates['1'];
    
        if (remainingMonths >= 12) {
          const years = Math.floor(remainingMonths / 12);
          costPerBag += years * yearlyRate;
          remainingMonths %= 12;
        }
    
        if (remainingMonths >= 6) {
          costPerBag += halfYearlyRate;
          // After applying a 6-month rate, we don't charge for smaller periods within that block.
          remainingMonths = 0; 
        }
        
        // If it was less than 6 months initially, or a remainder exists AFTER yearly calc
        if (remainingMonths > 0) {
             costPerBag += remainingMonths * monthlyRate;
        }

        const finalCost = costPerBag * withdrawQuantity;

        return { totalMonths, finalCost, costPerBag };

    }, [batch, cropType, withdrawQuantity]);


    async function handleOutflow() {
        if (!firestore || !batch || !user || !cropType || withdrawQuantity <= 0) return;
        
        if (withdrawQuantity > totalQuantity) {
            toast({
                variant: "destructive",
                title: "Invalid Quantity",
                description: "Withdrawal quantity cannot exceed the total quantity in the batch.",
            });
            return;
        }

        setIsProcessing(true);

        const batchRef = doc(firestore, "cropBatches", batch.id);

        const invoiceData: InvoiceData = {
          type: 'Outflow',
          receiptNumber: batch.id.slice(0, 8).toUpperCase(),
          date: new Date(),
          customer: {
            name: batch.customerName,
            mobile: 'N/A', // Mobile not available on batch, could be added
          },
          user: {
            name: user.displayName || 'N/A',
            email: user.email || 'N/A'
          },
          items: [{
            description: `Storage for ${batch.cropType} (${totalMonths} months)`,
            quantity: withdrawQuantity,
            unit: 'bags',
            unitPrice: costPerBag,
            total: finalCost,
          }],
          labourCharge: batch.labourCharge,
          subTotal: finalCost,
          total: finalCost + (batch.labourCharge || 0),
          notes: `Thank you for your business! This bill covers ${totalMonths} months of storage.`,
        };

        if (withdrawQuantity === totalQuantity) {
            // Full withdrawal, delete the document
            deleteDocumentNonBlocking(batchRef);
            toast({
                title: "Full Outflow Successful!",
                description: `${withdrawQuantity} bags for ${batch.customerName} removed.`,
                action: <Button variant="outline" size="sm" onClick={() => generateInvoicePdf(invoiceData)}>Download PDF</Button>,
                duration: 10000,
            });
        } else {
            // Partial withdrawal, update the allocations
            let remainingWithdrawal = withdrawQuantity;
            const newAllocations: AreaAllocation[] = [];

            // Important: sort to ensure consistent withdrawal order
            const sortedAllocations = [...batch.areaAllocations].sort((a, b) => a.areaId.localeCompare(b.areaId));

            for (const alloc of sortedAllocations) {
                if (remainingWithdrawal <= 0) {
                    newAllocations.push(alloc);
                    continue;
                }

                if (alloc.quantity > remainingWithdrawal) {
                    newAllocations.push({
                        ...alloc,
                        quantity: alloc.quantity - remainingWithdrawal,
                    });
                    remainingWithdrawal = 0;
                } else {
                    remainingWithdrawal -= alloc.quantity;
                    // This allocation is now empty, so we don't add it to newAllocations
                }
            }
            
            const updatedData = { areaAllocations: newAllocations };
            updateDocumentNonBlocking(batchRef, updatedData);
             toast({
                title: "Partial Outflow Successful!",
                description: `${withdrawQuantity} bags for ${batch.customerName} removed.`,
                action: <Button variant="outline" size="sm" onClick={() => generateInvoicePdf(invoiceData)}>Download PDF</Button>,
                duration: 10000,
            });
        }
        
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
            Enter the quantity to withdraw. The bill will be calculated based on this amount.
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
                    <p className="font-medium text-muted-foreground">Total Stored</p>
                    <p className="font-semibold">{totalQuantity.toLocaleString()} bags</p>
                </div>
                <div>
                    <p className="font-medium text-muted-foreground">Date Added</p>
                    <p className="font-semibold">{format(new Date(batch.dateAdded), "MMM d, yyyy")}</p>
                </div>
            </div>

            <div className="grid gap-2">
                <Label htmlFor="quantity">Quantity to Withdraw (bags)</Label>
                <Input
                    id="quantity"
                    type="number"
                    value={withdrawQuantity}
                    onChange={(e) => setWithdrawQuantity(Number(e.target.value))}
                    max={totalQuantity}
                    min={1}
                />
            </div>
            
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                 <div className="flex justify-between items-baseline">
                    <p className="text-muted-foreground">Storage Duration:</p>
                    <p className="font-semibold">{totalMonths} months</p>
                </div>
                <div className="flex justify-between items-baseline">
                    <p className="text-muted-foreground">Storage Cost:</p>
                    <p className="font-semibold">${finalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                {batch.labourCharge && batch.labourCharge > 0 && (
                    <div className="flex justify-between items-baseline">
                        <p className="text-muted-foreground">Inflow Labour Charge:</p>
                        <p className="font-semibold">${batch.labourCharge.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                )}
                 <div className="flex justify-between items-center mt-2 pt-2 border-t">
                    <p className="text-lg font-bold">Final Bill:</p>
                    <p className="text-2xl font-bold text-primary">${(finalCost + (batch.labourCharge || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isProcessing}>Cancel</Button>
          <Button onClick={handleOutflow} disabled={isProcessing || withdrawQuantity <= 0 || withdrawQuantity > totalQuantity} className="bg-primary hover:bg-primary/90">
             {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Outflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
