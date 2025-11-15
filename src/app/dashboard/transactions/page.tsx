
"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileDown } from "lucide-react";
import { useCollection, useFirebase, useUser, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import type { Outflow, Customer } from "@/lib/data";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { generateInvoicePdf } from "@/lib/pdf";
import { Badge } from "@/components/ui/badge";

export default function TransactionsPage() {
  const { firestore } = useFirebase();
  const { user } = useUser();

  const outflowsQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, 'outflows'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );
  const { data: outflows, isLoading: isLoadingOutflows } = useCollection<Outflow>(outflowsQuery);

  const customersQuery = useMemoFirebase(() =>
    user ? query(collection(firestore, 'customers'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );
  const { data: customers, isLoading: isLoadingCustomers } = useCollection<Customer>(customersQuery);

  const outflowsWithCustomerData = useMemo(() => {
    if (!outflows || !customers) return [];
    
    // Sort transactions by date descending here on the client-side
    const sortedOutflows = [...outflows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return sortedOutflows.map(outflow => {
      const customer = customers.find(c => c.id === outflow.customerId);
      return {
        ...outflow,
        customerName: customer?.name || 'Unknown',
      };
    });
  }, [outflows, customers]);

  const isLoading = isLoadingOutflows || isLoadingCustomers;

  return (
    <>
      <PageHeader
        title="Transaction History"
        description="A complete log of all outflow transactions and payments."
      />
      <Card>
        <CardHeader>
          <CardTitle>All Outflows</CardTitle>
          <CardDescription>
            {outflows?.length || 0} transactions found.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Receipt No.</TableHead>
                <TableHead className="text-right">Total Bill</TableHead>
                <TableHead className="text-right">Amount Paid</TableHead>
                <TableHead className="text-right">Balance Due</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              ) : outflowsWithCustomerData.length > 0 ? (
                outflowsWithCustomerData.map((outflow) => (
                  <TableRow key={outflow.id}>
                    <TableCell>{format(new Date(outflow.date), "MMM d, yyyy")}</TableCell>
                    <TableCell className="font-medium">{outflow.customerName}</TableCell>
                    <TableCell className="font-mono text-xs">{outflow.id.slice(0, 8).toUpperCase()}</TableCell>
                    <TableCell className="text-right">${outflow.totalBill.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right text-green-600">${outflow.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">
                      {outflow.balanceDue > 0 ? (
                        <Badge variant="destructive">${outflow.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Badge>
                      ) : (
                        <span className="text-muted-foreground">$0.00</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => generateInvoicePdf(outflow.invoiceData)}>
                        <FileDown className="h-5 w-5" />
                        <span className="sr-only">Download Invoice for {outflow.id}</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    No transactions found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
