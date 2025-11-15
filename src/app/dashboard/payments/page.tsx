
"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, CreditCard, Calendar, User, ShoppingBag } from "lucide-react";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import type { Payment, Customer, Outflow } from "@/lib/data";
import { format, formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function PaymentsPage() {
  const { firestore, user } = useFirebase();
  const [searchTerm, setSearchTerm] = useState("");

  const paymentsQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, 'payments'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );
  const { data: unsortedPayments, isLoading: isLoadingPayments } = useCollection<Payment>(paymentsQuery);

  const customersQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, 'customers'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );
  const { data: customers, isLoading: isLoadingCustomers } = useCollection<Customer>(customersQuery);

  const getCustomerName = (customerId: string) => customers?.find(c => c.id === customerId)?.name || 'N/A';

  const payments = useMemo(() => {
    if (!unsortedPayments) return [];
    
    const filtered = unsortedPayments.filter(payment => {
        const customerName = getCustomerName(payment.customerId).toLowerCase();
        const search = searchTerm.toLowerCase();
        return customerName.includes(search) || payment.outflowId.toLowerCase().includes(search);
    });

    return [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [unsortedPayments, customers, searchTerm]);

  const isLoading = isLoadingPayments || isLoadingCustomers;

  return (
    <>
      <PageHeader
        title="Payment History"
        description="A complete log of all payments received for outflows."
      />
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <CardTitle>All Payments</CardTitle>
                <CardDescription>
                  {payments?.length || 0} payments found.
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by customer or ID..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
          </div>
        </CardHeader>
        <CardContent>
           {isLoading ? (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            </div>
            ) : payments && payments.length > 0 ? (
            <>
                {/* Mobile View */}
                <div className="grid gap-4 md:hidden">
                    {payments.map((payment) => (
                        <Card key={payment.id} className="bg-muted/30">
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-base">{getCustomerName(payment.customerId)}</CardTitle>
                                        <CardDescription>Receipt #{payment.outflowId.slice(0,6)}</CardDescription>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold">₹{payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                        <Badge variant="secondary">{payment.paymentMethod}</Badge>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Calendar className="h-4 w-4" /><span>{format(new Date(payment.date), "MMM d, yyyy")}</span></div>
                                 {payment.notes && <p className="text-sm text-foreground mt-2">Notes: {payment.notes}</p>}
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Desktop View */}
                <div className="hidden md:block">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Outflow ID</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Notes</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                            {payments.map((payment) => (
                            <TableRow key={payment.id}>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span>{format(new Date(payment.date), "MMM d, yyyy")}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {formatDistanceToNow(new Date(payment.date), { addSuffix: true })}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="font-medium">{getCustomerName(payment.customerId)}</TableCell>
                                <TableCell>#{payment.outflowId.slice(0, 8).toUpperCase()}</TableCell>
                                <TableCell><Badge variant="outline">{payment.paymentMethod}</Badge></TableCell>
                                <TableCell className="text-sm text-muted-foreground">{payment.notes || '-'}</TableCell>
                                <TableCell className="text-right font-semibold">₹{payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </>
            ) : (
            <div className="h-64 flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 p-12 text-center">
                <CreditCard className="h-10 w-10 text-muted-foreground" />
                <p className="mt-4 text-sm text-muted-foreground">{searchTerm ? "No payments match your search." : "No payments found."}</p>
            </div>
            )}
        </CardContent>
      </Card>
    </>
  );
}
