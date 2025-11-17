
"use client";

import { useMemo, useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, CreditCard, Calendar, User, FileDown } from "lucide-react";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { Payment, Customer, Outflow, StorageLocation, CropBatch, CropType, StorageArea } from "@/lib/data";
import { format, formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { generatePaymentReceiptPdf, generateInvoicePdf } from "@/lib/pdf";

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

  const outflowsQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, 'outflows'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );
  const { data: outflows, isLoading: isLoadingOutflows } = useCollection<Outflow>(outflowsQuery);

  const batchesQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, 'cropBatches'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );
  const { data: batches, isLoading: isLoadingBatches } = useCollection<CropBatch>(batchesQuery);

  const locationsQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, 'storageLocations'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );
  const { data: locations, isLoading: isLoadingLocations } = useCollection<StorageLocation>(locationsQuery);

  const cropTypesQuery = useMemoFirebase(() =>
    user ? query(collection(firestore, 'cropTypes'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );
  const { data: cropTypes, isLoading: isLoadingCropTypes } = useCollection<CropType>(cropTypesQuery);

  const [allAreas, setAllAreas] = useState<StorageArea[]>([]);
  const [isLoadingAreas, setIsLoadingAreas] = useState(true);

  // Fetch all areas from all locations
  useEffect(() => {
    async function fetchAllAreas() {
      if (!locations || locations.length === 0 || !firestore) {
        setAllAreas([]);
        setIsLoadingAreas(false);
        return;
      };
      setIsLoadingAreas(true);
      const areas: StorageArea[] = [];
      for (const location of locations) {
        const areasColRef = collection(firestore, 'storageLocations', location.id, 'areas');
        const areasSnapshot = await getDocs(areasColRef);
        areasSnapshot.forEach(doc => {
          areas.push({ id: doc.id, ...doc.data() } as StorageArea);
        });
      }
      setAllAreas(areas);
      setIsLoadingAreas(false);
    }
    if(locations) fetchAllAreas();
  }, [locations, firestore]);

  const enrichedPayments = useMemo(() => {
    if (!unsortedPayments || !outflows || !customers || !batches || !locations || !cropTypes) return [];

    return unsortedPayments.map(payment => {
        const outflow = outflows.find(o => o.id === payment.outflowId);
        const customer = customers.find(c => c.id === payment.customerId);
        const batch = outflow ? batches.find(b => b.id === outflow.cropBatchId) : undefined;
        const location = batch ? locations.find(l => l.id === batch.storageLocationId) : undefined;
        const cropType = batch ? cropTypes.find(ct => ct.name === batch.cropType) : undefined;

        return {
            ...payment,
            customerName: customer?.name || 'N/A',
            outflow,
            customer,
            location,
            cropType,
        }
    }).filter(payment => {
        const search = searchTerm.toLowerCase();
        return payment.customerName.toLowerCase().includes(search) || payment.outflowId.toLowerCase().includes(search);
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  }, [unsortedPayments, outflows, customers, batches, locations, cropTypes, searchTerm]);


  const isLoading = isLoadingPayments || isLoadingCustomers || isLoadingOutflows || isLoadingBatches || isLoadingLocations || isLoadingCropTypes || isLoadingAreas;

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
                  {enrichedPayments?.length || 0} payments found.
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
            ) : enrichedPayments && enrichedPayments.length > 0 ? (
            <>
                {/* Mobile View */}
                <div className="grid gap-4 md:hidden">
                    {enrichedPayments.map((payment) => (
                      <Card key={payment.id} className="bg-muted/30">
                          <CardHeader>
                              <div className="flex justify-between items-start">
                                  <div>
                                      <CardTitle className="text-base">{payment.customerName}</CardTitle>
                                      <CardDescription>Receipt #{payment.id.slice(0,6)}</CardDescription>
                                  </div>
                                  <div className="text-right">
                                      <p className="text-lg font-bold">Rps {payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                      <Badge variant="secondary">{payment.paymentMethod}</Badge>
                                  </div>
                              </div>
                          </CardHeader>
                          <CardContent>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Calendar className="h-4 w-4" /><span>{format(new Date(payment.date), "MMM d, yyyy")}</span></div>
                               {payment.notes && <p className="text-sm text-foreground mt-2">Notes: {payment.notes}</p>}
                          </CardContent>
                           <CardFooter className="flex flex-col gap-2 items-stretch">
                              <Button variant="outline" size="sm" className="w-full" onClick={() => payment.outflow && payment.customer && generatePaymentReceiptPdf(payment, payment.outflow, payment.customer)} disabled={!payment.outflow || !payment.customer}>
                                  <FileDown className="mr-2 h-4 w-4" /> Download Receipt
                              </Button>
                              <Button variant="secondary" size="sm" className="w-full" onClick={() => payment.outflow && payment.customer && payment.location && payment.cropType && generateInvoicePdf(payment.outflow, payment.customer, payment.location, payment.cropType, allAreas)} disabled={!payment.outflow || !payment.customer || !payment.location || !payment.cropType}>
                                  <FileDown className="mr-2 h-4 w-4" /> Download Invoice
                              </Button>
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
                            <TableHead>Outflow ID</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Notes</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-center">Downloads</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                            {enrichedPayments.map((payment) => (
                              <TableRow key={payment.id}>
                                  <TableCell>
                                      <div className="flex flex-col">
                                          <span>{format(new Date(payment.date), "MMM d, yyyy")}</span>
                                          <span className="text-xs text-muted-foreground">
                                              {formatDistanceToNow(new Date(payment.date), { addSuffix: true })}
                                          </span>
                                      </div>
                                  </TableCell>
                                  <TableCell className="font-medium">{payment.customerName}</TableCell>
                                  <TableCell>#{payment.outflowId.slice(0, 8).toUpperCase()}</TableCell>
                                  <TableCell><Badge variant="outline">{payment.paymentMethod}</Badge></TableCell>
                                  <TableCell className="text-sm text-muted-foreground">{payment.notes || '-'}</TableCell>
                                  <TableCell className="text-right font-semibold">Rps {payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                  <TableCell className="text-center">
                                      <div className="flex justify-center gap-2">
                                          <Button variant="ghost" size="icon" onClick={() => payment.outflow && payment.customer && generatePaymentReceiptPdf(payment, payment.outflow, payment.customer)} title="Download Payment Receipt" disabled={!payment.outflow || !payment.customer}>
                                              <FileDown className="h-5 w-5" />
                                              <span className="sr-only">Download Receipt</span>
                                          </Button>
                                          <Button variant="ghost" size="icon" onClick={() => payment.outflow && payment.customer && payment.location && payment.cropType && generateInvoicePdf(payment.outflow, payment.customer, payment.location, payment.cropType, allAreas)} title="Download Outflow Invoice" disabled={!payment.outflow || !payment.customer || !payment.location || !payment.cropType}>
                                              <FileDown className="h-5 w-5 text-muted-foreground" />
                                              <span className="sr-only">Download Invoice</span>
                                          </Button>
                                      </div>
                                  </TableCell>
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

    
