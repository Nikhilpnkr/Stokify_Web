
"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileDown, Calendar, User, Wheat, ShoppingBag, Banknote, FileText, Search } from "lucide-react";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import type { Outflow, Customer, CropBatch } from "@/lib/data";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { generateInvoicePdf } from "@/lib/pdf";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function TransactionsPage() {
  const { firestore, user } = useFirebase();
  const [searchTerm, setSearchTerm] = useState("");

  const outflowsQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, 'outflows'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );
  const { data: unsortedOutflows, isLoading: isLoadingOutflows } = useCollection<Outflow>(outflowsQuery);

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

  const outflows = useMemo(() => {
    if (!unsortedOutflows) return [];
    
    const filtered = unsortedOutflows.filter(outflow => {
        const customerName = getCustomerName(outflow.customerId).toLowerCase();
        const cropType = getCropTypeFromBatch(outflow.cropBatchId).toLowerCase();
        const search = searchTerm.toLowerCase();
        return customerName.includes(search) || cropType.includes(search);
    });

    return [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [unsortedOutflows, customers, batches, searchTerm]);


  const isLoading = isLoadingOutflows || isLoadingCustomers || isLoadingBatches;

  return (
    <>
      <PageHeader
        title="Transaction History"
        description="A complete log of all outflow transactions."
      />
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <CardTitle>All Outflows</CardTitle>
                <CardDescription>
                  {outflows?.length || 0} transactions found.
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by customer or crop..."
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
            ) : outflows && outflows.length > 0 ? (
            <>
                {/* Mobile View */}
                <div className="grid gap-4 md:hidden">
                    {outflows.map((outflow) => (
                        <Card key={outflow.id} className="bg-muted/30">
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-base">{getCustomerName(outflow.customerId)}</CardTitle>
                                        <CardDescription>{getCropTypeFromBatch(outflow.cropBatchId)}</CardDescription>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold">₹{outflow.totalBill.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                        {outflow.balanceDue > 0 ? (
                                            <Badge variant="destructive">Due: ₹{outflow.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Badge>
                                        ) : (
                                            <Badge variant="secondary">Paid</Badge>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2"><ShoppingBag className="h-4 w-4" /><span>{outflow.quantityWithdrawn.toLocaleString()} bags withdrawn</span></div>
                                <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /><span>{format(new Date(outflow.date), "MMM d, yyyy")}</span></div>
                            </CardContent>
                             <CardFooter>
                                {outflow.invoiceData && (
                                    <Button variant="outline" size="sm" onClick={() => generateInvoicePdf(outflow.invoiceData)} title="Download Outflow Receipt" className="w-full">
                                        <FileDown className="h-4 w-4 mr-2" />
                                        Download Receipt
                                    </Button>
                                )}
                            </CardFooter>
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
                            <TableHead>Crop Type</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                            <TableHead className="text-right">Total Bill</TableHead>
                            <TableHead className="text-right">Amount Paid</TableHead>
                            <TableHead className="text-right">Balance Due</TableHead>
                            <TableHead className="text-center">Receipt</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                            {outflows.map((outflow) => (
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
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </>
            ) : (
            <div className="h-64 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 p-12 text-center">
                <FileText className="h-10 w-10 text-muted-foreground" />
                <p className="mt-4 text-sm text-muted-foreground">{searchTerm ? "No transactions match your search." : "No transactions found."}</p>
            </div>
            )}
        </CardContent>
      </Card>
    </>
  );
}

    