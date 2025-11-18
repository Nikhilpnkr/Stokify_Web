
"use client";

import { useState, useEffect } from "react";
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
import { useFirebase, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase";
import { doc, collection } from "firebase/firestore";
import type { Outflow, Payment, Customer } from "@/lib/data";
import { Loader2 } from "lucide-react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { generatePaymentReceiptPdf } from "@/lib/pdf";
import { sendSms } from "@/lib/sms";


type PayDuesDialogProps = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  outflow: Outflow | null;
};

export function PayDuesDialog({ isOpen, setIsOpen, outflow }: PayDuesDialogProps) {
    const { toast } = useToast();
    const { firestore, user } = useFirebase();
    const [isProcessing, setIsProcessing] = useState(false);
    const [amountToPay, setAmountToPay] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Online'>('Cash');
    const [notes, setNotes] = useState('');

    const customerRef = useMemoFirebase(() =>
        outflow ? doc(firestore, 'customers', outflow.customerId) : null,
    [firestore, outflow]);
    const { data: customer, isLoading: isLoadingCustomer } = useDoc<Customer>(customerRef);

    useEffect(() => {
        if (isOpen && outflow) {
            setAmountToPay(outflow.balanceDue);
            setPaymentMethod('Cash');
            setNotes('');
        } else if (!isOpen) {
            setIsProcessing(false);
            setAmountToPay(0);
        }
    }, [isOpen, outflow]);

    async function handlePayment() {
        if (!firestore || !outflow || !user || !customer) return;

        if (amountToPay <= 0) {
            toast({ variant: "destructive", title: "Invalid Amount", description: "Payment amount must be positive." });
            return;
        }

        if (amountToPay > outflow.balanceDue) {
            toast({ variant: "destructive", title: "Invalid Amount", description: "Payment cannot exceed the balance due." });
            return;
        }

        setIsProcessing(true);

        const newPaymentRef = doc(collection(firestore, "payments"));
        const outflowRef = doc(firestore, "outflows", outflow.id);
        
        const newBalanceDue = outflow.balanceDue - amountToPay;
        
        const newPayment: Payment = {
            id: newPaymentRef.id,
            outflowId: outflow.id,
            customerId: outflow.customerId,
            ownerId: user.uid,
            date: new Date().toISOString(),
            amount: amountToPay,
            paymentMethod,
            notes,
        };

        // Create a new payment document
        addDocumentNonBlocking(newPaymentRef, newPayment);
        
        // Update the outflow document
        const updatedOutflowData = {
            amountPaid: outflow.amountPaid + amountToPay,
            balanceDue: newBalanceDue,
        };
        updateDocumentNonBlocking(outflowRef, updatedOutflowData);

        const updatedOutflow = { ...outflow, ...updatedOutflowData };

        // Send SMS for payment
        const paymentSms = `Stokify: Payment of ${amountToPay.toFixed(2)} Rps received. New balance for txn #${outflow.id.slice(0, 6)} is ${newBalanceDue.toFixed(2)} Rps.`;
        sendSms({ to: customer.mobileNumber, message: paymentSms }).catch(console.error);

        toast({
            title: "Payment Successful!",
            description: `Paid ${amountToPay.toLocaleString()} Rps towards the balance.`,
            action: <Button variant="outline" size="sm" onClick={() => generatePaymentReceiptPdf(newPayment, updatedOutflow, customer)}>Download Receipt</Button>,
            duration: 10000,
        });

        setIsProcessing(false);
        setIsOpen(false);
    }

    if (!outflow) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record a Payment</DialogTitle>
          <DialogDescription>
            Record a payment for transaction #{outflow.id.slice(0, 8).toUpperCase()}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                 <div className="flex justify-between items-baseline">
                    <p className="text-muted-foreground">Total Bill:</p>
                    <p className="font-semibold">{outflow.totalBill.toLocaleString(undefined, { minimumFractionDigits: 2 })} Rps</p>
                </div>
                <div className="flex justify-between items-baseline">
                    <p className="text-muted-foreground">Current Amount Paid:</p>
                    <p className="font-semibold">{outflow.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })} Rps</p>
                </div>
                 <div className="flex justify-between items-center mt-2 pt-2 border-t">
                    <p className="text-lg font-bold">Balance Due:</p>
                    <p className="text-xl font-bold text-destructive">{outflow.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })} Rps</p>
                </div>
            </div>

             <div className="grid gap-2">
                <Label htmlFor="amountToPay">Amount to Pay</Label>
                <Input
                    id="amountToPay"
                    type="number"
                    value={amountToPay}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                     onChange={(e) => {
                        const val = Number(e.target.value);
                         if (val >= 0 && val <= outflow.balanceDue) {
                            setAmountToPay(val);
                         }
                    }}
                    max={outflow.balanceDue}
                    min={0}
                />
            </div>

             <div className="grid gap-2">
                <Label>Payment Method</Label>
                <RadioGroup defaultValue="Cash" onValueChange={(value: 'Cash' | 'Card' | 'Online') => setPaymentMethod(value)} className="flex space-x-4">
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
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g., Payment for last month"
                />
            </div>

             <div className="rounded-lg bg-primary/10 text-primary-foreground p-4 space-y-2 border border-primary/20">
                <div className="flex justify-between items-center">
                    <p className="text-lg font-bold text-primary">New Balance:</p>
                    <p className="text-2xl font-bold text-primary">{(outflow.balanceDue - amountToPay).toLocaleString(undefined, { minimumFractionDigits: 2 })} Rps</p>
                </div>
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isProcessing}>Cancel</Button>
          <Button 
            onClick={handlePayment} 
            disabled={isProcessing || amountToPay <= 0 || amountToPay > outflow.balanceDue || isLoadingCustomer}
          >
             {(isProcessing || isLoadingCustomer) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
