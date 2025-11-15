
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
import { useFirebase, deleteDocumentNonBlocking, updateDocumentNonBlocking, setDocumentNonBlocking, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, query, where } from "firebase/firestore";
import type { CropBatch, CropType, AreaAllocation, StorageLocation, Customer, Outflow, StorageArea } from "@/lib/data";
import { differenceInMonths, format } from "date-fns";
import { Loader2 } from "lucide-react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { generateInvoicePdf } from "@/lib/pdf";

type OutflowDialogProps = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  batch: CropBatch | null;
  cropType: CropType | undefined;
  locations: StorageLocation[];
  allAreas: StorageArea[];
};

export function OutflowDialog({ isOpen, setIsOpen, batch, cropType, locations, allAreas }: OutflowDialogProps) {
    const { toast } = useToast();
    const { firestore, user } = useFirebase();
    const [isProcessing, setIsProcessing] = useState(false);
    const [withdrawQuantity, setWithdrawQuantity] = useState(0);
    const [amountPaid, setAmountPaid] = useState(0);
    
    const location = locations?.find(l => l.id === batch?.storageLocationId);

    const customerRef = useMemoFirebase(() => 
        batch ? doc(firestore, 'customers', batch.customerId) : null, 
    [batch, firestore]);
    const { data: customer, isLoading: isLoadingCustomer } = useDoc<Customer>(customerRef);

    const totalQuantity = useMemo(() => {
        if (!batch) return 0;
        return batch.areaAllocations.reduce((sum, alloc) => sum + alloc.quantity, 0);
    }, [batch]);

    useEffect(() => {
        if (isOpen && batch) {
            const batchTotal = batch.areaAllocations.reduce((sum, alloc) => sum + alloc.quantity, 0);
            setWithdrawQuantity(batchTotal);
        } else if (!isOpen) {
            // Reset state when dialog closes
            setIsProcessing(false);
            setWithdrawQuantity(0);
            setAmountPaid(0);
        }
    }, [isOpen, batch]);

    const { totalMonths, storageCost, costPerBag, finalBill } = useMemo(() => {
        if (!batch || !cropType) {
          return { totalMonths: 0, storageCost: 0, costPerBag: 0, finalBill: 0 };
        }
    
        const startDate = new Date(batch.dateAdded);
        const endDate = new Date();
        let totalMonths = differenceInMonths(endDate, startDate);
        if (totalMonths < 1 && startDate.getTime() < endDate.getTime()) {
            totalMonths = 1;
        }
        if (totalMonths <= 0) totalMonths = 1;

        // If quantity is 0, storage cost is 0, but labour charge might still apply
        if (withdrawQuantity <= 0) {
            const finalBill = batch.labourCharge || 0;
            setAmountPaid(finalBill);
            return { totalMonths, storageCost: 0, costPerBag: 0, finalBill };
        }

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
          remainingMonths = 0; 
        }
        
        if (remainingMonths > 0) {
             costPerBag += remainingMonths * monthlyRate;
        }

        const storageCost = costPerBag * withdrawQuantity;
        const finalBill = storageCost + (batch.labourCharge || 0);
        
        // Auto-fill amount paid when bill is calculated
        setAmountPaid(finalBill);

        return { totalMonths, storageCost, costPerBag, finalBill };

    }, [batch, cropType, withdrawQuantity]);


    async function handleOutflow() {
        if (!firestore || !batch || !user || !cropType || !location || !customer) return;
        
        if (withdrawQuantity > totalQuantity) {
            toast({
                variant: "destructive",
                title: "Invalid Quantity",
                description: "Withdrawal quantity cannot exceed the total quantity in the batch.",
            });
            return;
        }
        
        if (amountPaid > finalBill) {
            toast({
                variant: "destructive",
                title: "Invalid Payment",
                description: "Amount paid cannot exceed the final bill.",
            });
            return;
        }
        
        if (finalBill <= 0 && withdrawQuantity <= 0) {
            toast({
                variant: "destructive",
                title: "No Bill",
                description: "There is nothing to bill for this transaction.",
            });
            return;
        }

        setIsProcessing(true);

        const batchRef = doc(firestore, "cropBatches", batch.id);
        const newOutflowRef = doc(collection(firestore, "outflows"));

        const balanceDue = finalBill - amountPaid;

        const newOutflow: Outflow = {
            id: newOutflowRef.id,
            cropBatchId: batch.id,
            customerId: batch.customerId,
            ownerId: user.uid,
            date: new Date().toISOString(),
            quantityWithdrawn: withdrawQuantity,
            totalBill: finalBill,
            amountPaid: amountPaid,
            balanceDue: balanceDue,
            storageDuration: totalMonths,
            storageCost: storageCost,
            labourCharge: batch.labourCharge || 0,
        };
        
        setDocumentNonBlocking(newOutflowRef, newOutflow, {merge: false});

        if (withdrawQuantity === totalQuantity) {
            // Full withdrawal, delete the document
            deleteDocumentNonBlocking(batchRef);
            toast({
                title: "Full Outflow Successful!",
                description: `${withdrawQuantity} bags for ${batch.customerName} removed.`,
                action: <Button variant="outline" size="sm" onClick={() => generateInvoicePdf(newOutflow, customer, location, cropType, allAreas)}>Download PDF</Button>,
                duration: 10000,
            });
        } else {
            // Partial withdrawal or zero withdrawal (just paying labour)
            let remainingWithdrawal = withdrawQuantity;
            const newAllocations: AreaAllocation[] = [];

            // Sort allocations to withdraw from alphabetically named areas first
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
                }
            }
            
            // After any outflow, the labor charge is considered billed and tracked in the outflow record.
            // We set it to 0 on the original batch to prevent double-billing.
            const updatedData = { 
                areaAllocations: newAllocations,
                labourCharge: 0,
            };

            updateDocumentNonBlocking(batchRef, updatedData);
            
             if (withdrawQuantity > 0) {
                toast({
                    title: "Partial Outflow Successful!",
                    description: `${withdrawQuantity} bags for ${batch.customerName} removed.`,
                    action: <Button variant="outline" size="sm" onClick={() => generateInvoicePdf(newOutflow, customer, location, cropType, allAreas)}>Download PDF</Button>,
                    duration: 10000,
                });
            } else {
                toast({
                    title: "Bill Settled!",
                    description: `A bill for ${batch.customerName} was processed for ₹${finalBill.toLocaleString()}.`,
                    action: <Button variant="outline" size="sm" onClick={() => generateInvoicePdf(newOutflow, customer, location, cropType, allAreas)}>Download PDF</Button>,
                    duration: 10000,
                });
            }
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
            Enter the quantity to withdraw and the payment amount.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            {isLoadingCustomer ? <Loader2 className="h-5 w-5 animate-spin"/> :
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="font-medium text-muted-foreground">Customer</p>
                        <p className="font-semibold">{batch.customerName}</p>
                    </div>
                     <div>
                        <p className="font-medium text-muted-foreground">Mobile</p>
                        <p className="font-semibold">{customer?.mobileNumber}</p>
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
            }

            <div className="grid gap-2">
                <Label htmlFor="quantity">Quantity to Withdraw (bags)</Label>
                <Input
                    id="quantity"
                    type="number"
                    value={withdrawQuantity}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    onChange={(e) => {
                        const val = Number(e.target.value);
                         if (val >= 0 && val <= totalQuantity) {
                            setWithdrawQuantity(val)
                         }
                    }}
                    max={totalQuantity}
                    min={0}
                />
            </div>
            
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                 <div className="flex justify-between items-baseline">
                    <p className="text-muted-foreground">Storage Duration:</p>
                    <p className="font-semibold">{totalMonths} months</p>
                </div>
                <div className="flex justify-between items-baseline">
                    <p className="text-muted-foreground">Storage Cost:</p>
                    <p className="font-semibold">₹{storageCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                {batch.labourCharge && batch.labourCharge > 0 && (
                    <div className="flex justify-between items-baseline">
                        <p className="font-medium text-muted-foreground">Inflow Labour Charge:</p>
                        <p className="font-semibold">₹{batch.labourCharge.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                )}
                 <div className="flex justify-between items-center mt-2 pt-2 border-t">
                    <p className="text-lg font-bold">Final Bill:</p>
                    <p className="text-2xl font-bold text-primary">₹{finalBill.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
            </div>

             <div className="grid gap-2">
                <Label htmlFor="amountPaid">Amount Paid</Label>
                <Input
                    id="amountPaid"
                    type="number"
                    value={amountPaid}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                     onChange={(e) => {
                        const val = Number(e.target.value);
                         if (val >= 0 && val <= finalBill) {
                            setAmountPaid(val)
                         }
                    }}
                    max={finalBill}
                    min={0}
                />
            </div>

            <div className="rounded-lg bg-destructive/10 text-destructive-foreground p-4 space-y-2 border border-destructive/20">
                <div className="flex justify-between items-center">
                    <p className="text-lg font-bold">Balance Due:</p>
                    <p className="text-2xl font-bold">₹{(finalBill - amountPaid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isProcessing}>Cancel</Button>
          <Button 
            onClick={handleOutflow} 
            disabled={isProcessing || withdrawQuantity > totalQuantity || amountPaid > finalBill || (finalBill <= 0 && withdrawQuantity <= 0) || isLoadingCustomer} 
            className="bg-primary hover:bg-primary/90"
          >
             {(isProcessing || isLoadingCustomer) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Outflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}