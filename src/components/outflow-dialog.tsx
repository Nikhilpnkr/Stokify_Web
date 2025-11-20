
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
import { useFirebase, deleteDocumentNonBlocking, updateDocumentNonBlocking, addDocumentNonBlocking, useDoc, useMemoFirebase } from "@/firebase";
import { doc, collection } from "firebase/firestore";
import type { Inflow, CropType, AreaAllocation, StorageLocation, Customer, Outflow, StorageArea, Payment } from "@/lib/data";
import { differenceInMonths, format } from "date-fns";
import { Loader2 } from "lucide-react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { generateInvoicePdf } from "@/lib/pdf";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";

type OutflowDialogProps = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  inflow: Inflow | null;
  cropType: CropType | undefined;
  locations: StorageLocation[];
  allAreas: StorageArea[];
};

function toDate(dateValue: any): Date {
    if (!dateValue) return new Date();
    if (dateValue && typeof dateValue.seconds === 'number' && typeof dateValue.nanoseconds === 'number') {
        return new Date(dateValue.seconds * 1000 + dateValue.nanoseconds / 1000000);
    }
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return new Date();
    return date;
}

export function OutflowDialog({ isOpen, setIsOpen, inflow, cropType, locations, allAreas }: OutflowDialogProps) {
    const { toast } = useToast();
    const { firestore, user } = useFirebase();
    const [isProcessing, setIsProcessing] = useState(false);
    const [withdrawQuantity, setWithdrawQuantity] = useState(0);
    const [amountPaid, setAmountPaid] = useState(0);
    const [costPerBag, setCostPerBag] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Online'>('Cash');
    const [notes, setNotes] = useState('');
    
    const location = locations?.find(l => l.id === inflow?.storageLocationId);

    const customerRef = useMemoFirebase(() => 
        inflow ? doc(firestore, 'customers', inflow.customerId) : null, 
    [inflow, firestore]);
    const { data: customer, isLoading: isLoadingCustomer } = useDoc<Customer>(customerRef);

    const totalQuantity = useMemo(() => {
        if (!inflow) return 0;
        return inflow.areaAllocations.reduce((sum, alloc) => sum + alloc.quantity, 0);
    }, [inflow]);

    const { initialCostPerBag, totalMonths } = useMemo(() => {
        if (!inflow || !cropType) {
            return { initialCostPerBag: 0, totalMonths: 0 };
        }

        const startDate = toDate(inflow.dateAdded);
        const endDate = new Date();
        let months = differenceInMonths(endDate, startDate);
        if (months < 1 && endDate.getTime() > startDate.getTime()) months = 1;
        if (months <= 0) months = 1;

        let calculatedCost = 0;
        const yearlyRate = cropType.rates['12'];
        const halfYearlyRate = cropType.rates['6'];

        const numYears = Math.floor(months / 12);
        const remainingMonths = months % 12;

        calculatedCost += numYears * yearlyRate;

        if (remainingMonths > 6) {
          calculatedCost += yearlyRate;
        } else if (remainingMonths > 0) {
          calculatedCost += halfYearlyRate;
        } else if (numYears === 0) { // If it's less than a year but more than 0 months
            calculatedCost = halfYearlyRate;
        }
        
        if (months === 0) calculatedCost = halfYearlyRate; // Minimum charge is for 6 months
        
        // This is only the storage cost. Insurance is added separately.
        return { initialCostPerBag: calculatedCost, totalMonths: months };
    }, [inflow, cropType]);

    const labourCharge = useMemo(() => {
        if (!inflow || !inflow.labourCharge) return 0;
        // The labour charge is a one-time fee applied at inflow,
        // so we return the full amount regardless of withdrawal quantity.
        return inflow.labourCharge;
    }, [inflow]);

    const { storageCost, insuranceCharge, finalBill } = useMemo(() => {
        const storage = costPerBag * withdrawQuantity;
        const insurance = (cropType?.insurance || 0) * withdrawQuantity;
        const labour = inflow?.labourCharge || 0; // Always include the full one-time labour charge
        const bill = storage + insurance + labour;
        return { storageCost: storage, insuranceCharge: insurance, finalBill: bill };
    }, [costPerBag, withdrawQuantity, cropType, inflow]);

    useEffect(() => {
        if (isOpen && inflow) {
            setWithdrawQuantity(0); // Default to 0
            setAmountPaid(0); // Default to 0
            setCostPerBag(initialCostPerBag);
            setPaymentMethod('Cash');
            setNotes('');
        } else if (!isOpen) {
            setIsProcessing(false);
            setWithdrawQuantity(0);
            setAmountPaid(0);
            setCostPerBag(0);
        }
    }, [isOpen, inflow, initialCostPerBag]);


    async function handleOutflow() {
        if (!firestore || !inflow || !user || !cropType || !location || !customer) return;
        
        if (withdrawQuantity > totalQuantity) {
            toast({ variant: "destructive", title: "Invalid Quantity" });
            return;
        }
        if (amountPaid > finalBill) {
            toast({ variant: "destructive", title: "Invalid Payment" });
            return;
        }
        if (finalBill <= 0 && withdrawQuantity <= 0) {
            toast({ variant: "destructive", title: "No Bill" });
            return;
        }

        setIsProcessing(true);

        const inflowRef = doc(firestore, "inflows", inflow.id);
        const newOutflowRef = doc(collection(firestore, "outflows"));

        const balanceDue = finalBill - amountPaid;
        const labour = inflow.labourCharge || 0;

        const newOutflow: Omit<Outflow, 'id'> & { id: string } = {
            id: newOutflowRef.id,
            inflowId: inflow.id,
            customerId: inflow.customerId,
            ownerId: user.uid,
            date: new Date().toISOString(),
            quantityWithdrawn: withdrawQuantity,
            totalBill: finalBill,
            amountPaid: amountPaid,
            balanceDue: balanceDue,
            cropTypeName: cropType.name,
            locationName: location.name,
            storageDuration: totalMonths,
            storageCost: storageCost,
            insuranceCharge: insuranceCharge,
            labourCharge: labour,
        };
        
        addDocumentNonBlocking(newOutflowRef, newOutflow);

        // If an initial payment is made, create a payment record for it
        if (amountPaid > 0) {
            const newPaymentRef = doc(collection(firestore, "payments"));
            const newPayment: Payment = {
                id: newPaymentRef.id,
                outflowId: newOutflow.id,
                customerId: newOutflow.customerId,
                ownerId: user.uid,
                date: new Date().toISOString(),
                amount: amountPaid,
                paymentMethod: paymentMethod,
                notes: notes || `Initial payment for outflow #${newOutflow.id.slice(0,6)}`,
            };
            addDocumentNonBlocking(newPaymentRef, newPayment);
        }

        if (withdrawQuantity === totalQuantity) {
            deleteDocumentNonBlocking(inflowRef);
            toast({
                title: "Full Outflow Successful!",
                description: `${withdrawQuantity} bags for ${customer.name} removed.`,
                action: <Button variant="outline" size="sm" onClick={() => generateInvoicePdf(newOutflow, customer, location, cropType, allAreas)}>Download PDF</Button>,
                duration: 10000,
            });
        } else {
            let remainingWithdrawal = withdrawQuantity;
            const newAllocations: AreaAllocation[] = [];
            const sortedAllocations = [...inflow.areaAllocations].sort((a, b) => a.areaId.localeCompare(b.areaId));

            for (const alloc of sortedAllocations) {
                if (remainingWithdrawal <= 0) {
                    newAllocations.push(alloc);
                    continue;
                }
                if (alloc.quantity > remainingWithdrawal) {
                    newAllocations.push({ ...alloc, quantity: alloc.quantity - remainingWithdrawal });
                    remainingWithdrawal = 0;
                } else {
                    remainingWithdrawal -= alloc.quantity;
                }
            }
            
            const updatedData = { 
                areaAllocations: newAllocations,
                labourCharge: 0, // Set labour charge to 0 on the original inflow after a partial outflow to prevent double-charging
            };
            updateDocumentNonBlocking(inflowRef, updatedData);
            
            toast({
                title: withdrawQuantity > 0 ? "Partial Outflow Successful!" : "Bill Settled!",
                description: `${withdrawQuantity} bags for ${customer.name} removed.`,
                action: <Button variant="outline" size="sm" onClick={() => generateInvoicePdf(newOutflow, customer, location, cropType, allAreas)}>Download PDF</Button>,
                duration: 10000,
            });
        }
        
        setIsProcessing(false);
        setIsOpen(false);
    }

    if (!inflow) return null;

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
                            <p className="font-semibold">{customer?.name}</p>
                        </div>
                        <div>
                            <p className="font-medium text-muted-foreground">Mobile</p>
                            <p className="font-semibold">{customer?.mobileNumber}</p>
                        </div>
                        <div>
                            <p className="font-medium text-muted-foreground">Crop Type</p>
                            <p className="font-semibold">{cropType?.name}</p>
                        </div>
                        <div>
                            <p className="font-medium text-muted-foreground">Total Stored</p>
                            <p className="font-semibold">{totalQuantity.toLocaleString()} bags</p>
                        </div>
                        <div>
                            <p className="font-medium text-muted-foreground">Date Added</p>
                            <p className="font-semibold">{format(toDate(inflow.dateAdded), "MMM d, yyyy")}</p>
                        </div>
                         {labourCharge > 0 && (
                            <div className="col-span-2">
                                <p className="font-medium text-muted-foreground">Initial Labour Charge</p>
                                <p className="font-semibold">{labourCharge.toLocaleString(undefined, { minimumFractionDigits: 2 })} Rp</p>
                                <p className="text-xs text-muted-foreground">This one-time charge is added to the bill on final outflow.</p>
                            </div>
                        )}
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
                            if (val >= 0 && val <= totalQuantity) setWithdrawQuantity(val)
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
                    <div className="grid gap-2">
                        <Label htmlFor="costPerBag">Cost per Bag (Storage)</Label>
                        <Input
                            id="costPerBag"
                            type="number"
                            value={costPerBag}
                            onWheel={(e) => (e.target as HTMLElement).blur()}
                            onChange={(e) => setCostPerBag(Number(e.target.value))}
                        />
                        <p className="text-xs text-muted-foreground">
                            Calculated rate: {initialCostPerBag.toFixed(2)} Rp. Insurance per bag: {cropType?.insurance || 0} Rp.
                        </p>
                    </div>
                    <div className="flex justify-between items-baseline">
                        <p className="text-muted-foreground">Total Storage Cost (Qty x Rate):</p>
                        <p className="font-semibold">{storageCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Rp</p>
                    </div>
                    <div className="flex justify-between items-baseline">
                        <p className="text-muted-foreground">Total Insurance (Qty x Rate):</p>
                        <p className="font-semibold">{insuranceCharge.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Rp</p>
                    </div>
                    {labourCharge > 0 && (
                        <div className="flex justify-between items-baseline">
                            <p className="text-muted-foreground">Labour Charge:</p>
                            <p className="font-semibold">{labourCharge.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Rp</p>
                        </div>
                    )}
                    
                    <div className="flex justify-between items-center mt-2 pt-2 border-t">
                        <p className="text-lg font-bold">Final Bill:</p>
                        <p className="text-2xl font-bold text-primary">{finalBill.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Rp</p>
                    </div>
                </div>

                <div className="rounded-lg bg-muted/50 p-4 space-y-4">
                     <div className="grid gap-2">
                        <Label htmlFor="amountPaid">Amount Paid</Label>
                        <Input
                            id="amountPaid"
                            type="number"
                            value={amountPaid}
                            onWheel={(e) => (e.target as HTMLElement).blur()}
                            onChange={(e) => {
                                const val = Number(e.target.value);
                                if (val >= 0 && val <= finalBill) setAmountPaid(val)
                            }}
                            max={finalBill}
                            min={0}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Payment Method</Label>
                        <RadioGroup value={paymentMethod} onValueChange={(value: 'Cash' | 'Card' | 'Online') => setPaymentMethod(value)} className="flex space-x-4">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Cash" id="cash"/>
                                <Label htmlFor="cash">Cash</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Card" id="card"/>
                                <Label htmlFor="card">Card</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Online" id="online"/>
                                <Label htmlFor="online">Online</Label>
                            </div>
                        </RadioGroup>
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="notes">Payment Notes (Optional)</Label>
                        <Input
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="e.g., Initial payment"
                        />
                    </div>
                </div>

                <div className="rounded-lg bg-destructive/10 text-destructive-foreground p-4 space-y-2 border border-destructive/20">
                    <div className="flex justify-between items-center">
                        <p className="text-lg font-bold">Balance Due:</p>
                        <p className="text-2xl font-bold">{(finalBill - amountPaid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Rp</p>
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

    
    
    