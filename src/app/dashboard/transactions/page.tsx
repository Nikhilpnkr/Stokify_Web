
"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileDown } from "lucide-react";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy } from "firebase/firestore";
import type { Outflow, Customer, CropBatch } from "@/lib/data";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { generateInvoicePdf } from "@/lib/pdf";
import { Badge } from "@/components/ui/badge";

export default function TransactionsPage() {
  const { firestore, user } = useFirebase();

  const outflowsQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, 'outflows'), where('ownerId', '==', user.uid), orderBy('date', 'desc')) : null,
    [firestore, user]
  );
  const { data: outflows, isLoading: isLoadingOutflows } = useCollection<Outflow>(outflowsQuery);

  const customersQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, 'customers'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );
  const { data: customers, isLoading: isLoadingCustomers } = useCollection<Customer>(customersQuery);
  
  const batchesQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, 'cropBatches'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );
  const { data: batches, isLoading: isLoadingBatches } = useCollection<CropBatch>(batchesQuery);
  
  const getCustomerName = (customerId: string) => customers?.find(c => c.id === customerId)?.name || 'N/A';
  const getCropTypeFromBatch = (batchId: string) => batches?.find(b => b.id === batchId)?.cropType || 'N/A';

  const isLoading = isLoadingOutflows || isLoadingCustomers || isLoadingBatches;

  return (
    <>
      <PageHeader
        title="Transaction History"
        description="A complete log of all outflow transactions."
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
                <TableHead>Crop Type</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Total Bill</TableHead>
                <TableHead className="text-right">Amount Paid</TableHead>
                <TableHead className="text-right">Balance Due</TableHead>
                <TableHead className="text-center">Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              ) : outflows && outflows.length > 0 ? (
                outflows.map((outflow) => (
                  <TableRow key={outflow.id}>
                    <TableCell>
                        <div className="flex flex-col">
                            <span>{format(new Date(outflow.date), "MMM d, yyyy")}</span>
                            <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(outflow.date), { addSuffix: true })}
                            </span>
                        </div>
                    </TableCell>
                    <TableCell className="font-medium">{getCustomerName(outflow.customerId)}</TableCell>
                    <TableCell>{getCropTypeFromBatch(outflow.cropBatchId)}</TableCell>
                    <TableCell className="text-right">{outflow.quantityWithdrawn.toLocaleString()} bags</TableCell>
                    <TableCell className="text-right">₹{outflow.totalBill.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">₹{outflow.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">
                        {outflow.balanceDue > 0 ? (
                            <Badge variant="destructive">₹{outflow.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Badge>
                        ) : (
                            <span className="text-muted-foreground">-</span>
                        )}
                    </TableCell>
                    <TableCell className="text-center">
                      {outflow.invoiceData && (
                          <Button variant="ghost" size="icon" onClick={() => generateInvoicePdf(outflow.invoiceData)} title="Download Outflow Receipt">
                              <FileDown className="h-5 w-5" />
                              <span className="sr-only">Download Outflow Receipt</span>
                          </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
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
