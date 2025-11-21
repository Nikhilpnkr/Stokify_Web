
"use client";

import { useMemo, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirebase, useDoc, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase";
import { doc, collection, query, where } from "firebase/firestore";
import type { Customer, Outflow, Payment, UserProfile } from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { Loader2, User, Phone, Banknote } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { generatePaymentReceiptPdf } from "@/lib/pdf";

export default function PayDuesPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const router = useRouter();
  const { firestore, user } = useFirebase();
  const { toast } = useToast();

  const [selectedOutflows, setSelectedOutflows] = useState<Record<string, boolean>>({});
  const [amountToPay, setAmountToPay] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Online'>('Cash');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const userProfileRef = useMemoFirebase(() => 
    user ? doc(firestore, 'users', user.uid) : null
  , [firestore, user]);
  const { data: userProfile, isLoading: isLoadingProfile } = useDoc<UserProfile>(userProfileRef);

  const customerRef = useMemoFirebase(() =>
    customerId ? doc(firestore, 'customers', customerId) : null,
    [firestore, customerId]
  );
  const { data: customer, isLoading: isLoadingCustomer } = useDoc<Customer>(customerRef);

  const outflowsQuery = useMemoFirebase(() => {
    if (!user || !userProfile || !customerId) return null;
    const baseQuery = collection(firestore, 'outflows');
    const userSpecificQuery = query(baseQuery, where('customerId', '==', customerId), where('balanceDue', '>', 0));

    if (userProfile.role === 'admin' || userProfile.role === 'manager') {
        return userSpecificQuery;
    }
    return query(userSpecificQuery, where('ownerId', '==', user.uid));
  }, [firestore, user, userProfile, customerId]);
  
  const { data: dueOutflows, isLoading: isLoadingOutflows } = useCollection<Outflow>(outflowsQuery);

  const totalSelectedDues = useMemo(() => {
    if (!dueOutflows) return 0;
    return dueOutflows.reduce((acc, outflow) => {
      if (selectedOutflows[outflow.id]) {
        return acc + outflow.balanceDue;
      }
      return acc;
    }, 0);
  }, [dueOutflows, selectedOutflows]);
  
  // Effect to update amountToPay whenever selected dues change
  useEffect(() => {
    setAmountToPay(totalSelectedDues);
  }, [totalSelectedDues]);

  const handleSelectAll = (checked: boolean) => {
    const newSelection: Record<string, boolean> = {};
    if (checked && dueOutflows) {
      dueOutflows.forEach(o => newSelection[o.id] = true);
    }
    setSelectedOutflows(newSelection);
  };
  
  const handleSelectOne = (outflowId: string, checked: boolean) => {
    setSelectedOutflows(prev => ({...prev, [outflowId]: checked}));
  };

  const isAllSelected = dueOutflows ? dueOutflows.length > 0 && dueOutflows.every(o => selectedOutflows[o.id]) : false;

  async function handlePayment() {
    if (!firestore || !user || !customer || !dueOutflows) return;
    if (amountToPay <= 0) {
        toast({ variant: 'destructive', title: 'Invalid amount' });
        return;
    }
    
    setIsProcessing(true);

    let remainingAmountToPay = amountToPay;
    const outflowsToUpdate = dueOutflows.filter(o => selectedOutflows[o.id]).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (const outflow of outflowsToUpdate) {
        if (remainingAmountToPay <= 0) break;

        const paymentForThisOutflow = Math.min(outflow.balanceDue, remainingAmountToPay);
        const newBalance = outflow.balanceDue - paymentForThisOutflow;
        remainingAmountToPay -= paymentForThisOutflow;

        const newPaymentRef = doc(collection(firestore, "payments"));
        const newPayment: Payment = {
            id: newPaymentRef.id,
            outflowId: outflow.id,
            customerId: customer.id,
            ownerId: user.uid,
            date: new Date().toISOString(),
            amount: paymentForThisOutflow,
            paymentMethod,
            ...(notes && { notes }),
        };
        addDocumentNonBlocking(newPaymentRef, newPayment);
        
        const outflowRef = doc(firestore, "outflows", outflow.id);
        const updatedOutflowData = {
            amountPaid: outflow.amountPaid + paymentForThisOutflow,
            balanceDue: newBalance,
        };
        updateDocumentNonBlocking(outflowRef, updatedOutflowData);

        const updatedOutflow = { ...outflow, ...updatedOutflowData };
        toast({
            title: `Payment recorded for #${outflow.id.slice(0,6)}`,
            description: `Paid ${paymentForThisOutflow.toLocaleString()} Rp. New balance: ${newBalance.toLocaleString()} Rp.`,
            action: <Button variant="outline" size="sm" onClick={() => generatePaymentReceiptPdf(newPayment, updatedOutflow, customer)}>Receipt</Button>,
            duration: 7000
        });
    }
    
    toast({
        title: "Payment Process Complete",
        description: `Total paid: ${amountToPay.toLocaleString()} Rp.`,
        duration: 5000,
    });
    
    setIsProcessing(false);
    router.push(`/dashboard/customers/${customerId}`);
  }


  const isLoading = isLoadingProfile || isLoadingCustomer || isLoadingOutflows;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <p>Customer not found.</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={`Pay Dues for ${customer.name}`}
        description="Select the outstanding invoices to pay."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
            <Card>
                <CardHeader>
                    <CardTitle>Outstanding Invoices</CardTitle>
                    <CardDescription>Select the invoices you want to settle.</CardDescription>
                </CardHeader>
                <CardContent>
                    {dueOutflows && dueOutflows.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">
                                        <Checkbox 
                                            onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                                            checked={isAllSelected}
                                            aria-label="Select all"
                                        />
                                    </TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Invoice ID</TableHead>
                                    <TableHead className="text-right">Amount Due</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {dueOutflows.map(o => (
                                <TableRow key={o.id} data-state={selectedOutflows[o.id] && "selected"}>
                                    <TableCell>
                                        <Checkbox 
                                            onCheckedChange={(checked) => handleSelectOne(o.id, checked as boolean)}
                                            checked={selectedOutflows[o.id] || false}
                                            aria-label={`Select invoice ${o.id.slice(0,6)}`}
                                        />
                                    </TableCell>
                                    <TableCell>{format(new Date(o.date), "MMM d, yyyy")}</TableCell>
                                    <TableCell>#{o.id.slice(0,8).toUpperCase()}</TableCell>
                                    <TableCell className="text-right font-medium">{o.balanceDue.toLocaleString(undefined, {minimumFractionDigits: 2})} Rp</TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">No outstanding dues for this customer.</p>
                    )}
                </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-1">
            <Card className="sticky top-6">
                <CardHeader>
                    <CardTitle>Payment Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <Label className="text-muted-foreground">Total Selected Dues</Label>
                        <p className="text-2xl font-bold">{totalSelectedDues.toLocaleString(undefined, {minimumFractionDigits: 2})} Rp</p>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="amountToPay">Amount to Pay</Label>
                        <Input id="amountToPay" type="number" value={amountToPay} onChange={(e) => setAmountToPay(Number(e.target.value))} max={totalSelectedDues} />
                    </div>
                    <div className="space-y-2">
                        <Label>Payment Method</Label>
                        <RadioGroup defaultValue="Cash" onValueChange={(value: 'Cash' | 'Card' | 'Online') => setPaymentMethod(value)} className="flex space-x-4">
                            <div className="flex items-center space-x-2"><RadioGroupItem value="Cash" id="cash"/><Label htmlFor="cash">Cash</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="Card" id="card"/><Label htmlFor="card">Card</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="Online" id="online"/><Label htmlFor="online">Online</Label></div>
                        </RadioGroup>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes (Optional)</Label>
                        <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g., Full settlement"/>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button 
                        className="w-full"
                        disabled={isProcessing || amountToPay <= 0 || totalSelectedDues <= 0}
                        onClick={handlePayment}
                    >
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Banknote className="mr-2 h-4 w-4" />}
                        Pay {amountToPay.toLocaleString()} Rp
                    </Button>
                </CardFooter>
            </Card>
        </div>
      </div>
    </>
  );
}
