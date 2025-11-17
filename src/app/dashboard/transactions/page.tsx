
"use client";

import { useMemo, useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileDown, Calendar, User, Wheat, ShoppingBag, Banknote, FileText, Search } from "lucide-react";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { Outflow, Customer, StorageLocation, CropType, StorageArea } from "@/lib/data";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { generateInvoicePdf } from "@/lib/pdf";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PayDuesDialog } from "@/components/pay-dues-dialog";

export default function TransactionsPage() {
  const { firestore, user } = useFirebase();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOutflow, setSelectedOutflow] = useState<Outflow | null>(null);
  const [isPayDuesOpen, setIsPayDuesOpen] = useState(false);

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
  
  const enrichedOutflows = useMemo(() => {
    if (!unsortedOutflows || !customers || !locations || !cropTypes) return [];

    return unsortedOutflows.map(outflow => {
        const customer = customers.find(c => c.id === outflow.customerId);
        // Use the denormalized locationName to find the location object
        const location = locations.find(l => l.name === outflow.locationName);
        // Use the denormalized cropTypeName to find the cropType object
        const cropType = cropTypes.find(ct => ct.name === outflow.cropTypeName);

        return {
            ...outflow,
            customerName: customer?.name || 'N/A',
            customer, // include the full customer object
            location, // include the full location object
            cropType, // include the full cropType object
        };
    }).filter(outflow => {
      const search = searchTerm.toLowerCase();
      return outflow.customerName.toLowerCase().includes(search) || outflow.cropTypeName.toLowerCase().includes(search);
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  }, [unsortedOutflows, customers, locations, cropTypes, searchTerm]);


  const handlePayDuesClick = (outflow: Outflow) => {
    setSelectedOutflow(outflow);
    setIsPayDuesOpen(true);
  }

  const isLoading = isLoadingOutflows || isLoadingCustomers || isLoadingLocations || isLoadingCropTypes || isLoadingAreas;

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
                  {enrichedOutflows?.length || 0} transactions found.
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
            ) : enrichedOutflows && enrichedOutflows.length > 0 ? (
            <>
                {/* Mobile View */}
                <div className="grid gap-4 md:hidden">
                    {enrichedOutflows.map((outflow) => (
                        <Card key={outflow.id} className="bg-muted/30">
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-base">{outflow.customerName}</CardTitle>
                                        <CardDescription>{outflow.cropTypeName}</CardDescription>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold">Rps {outflow.totalBill.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                        {outflow.balanceDue > 0 ? (
                                            <Badge variant="destructive">Due: Rps {outflow.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Badge>
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
                             <CardFooter className="flex flex-col items-stretch gap-2">
                                <Button variant="outline" size="sm" onClick={() => outflow.customer && outflow.location && outflow.cropType && generateInvoicePdf(outflow, outflow.customer, outflow.location, outflow.cropType, allAreas)} title="Download Outflow Invoice" className="w-full" disabled={!outflow.customer || !outflow.location || !outflow.cropType}>
                                    <FileDown className="h-4 w-4 mr-2" />
                                    Download Invoice
                                </Button>
                                {outflow.balanceDue > 0 && (
                                    <Button size="sm" onClick={() => handlePayDuesClick(outflow)} className="w-full">
                                        <Banknote className="h-4 w-4 mr-2" />
                                        Pay Dues
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
                            <TableHead className="text-center">Action</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                            {enrichedOutflows.map((outflow) => (
                            <TableRow key={outflow.id}>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span>{format(new Date(outflow.date), "MMM d, yyyy")}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {formatDistanceToNow(new Date(outflow.date), { addSuffix: true })}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="font-medium">{outflow.customerName}</TableCell>
                                <TableCell>{outflow.cropTypeName}</TableCell>
                                <TableCell className="text-right">{outflow.quantityWithdrawn.toLocaleString()} bags</TableCell>
                                <TableCell className="text-right">Rps {outflow.totalBill.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                <TableCell className="text-right">Rps {outflow.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                <TableCell className="text-right">
                                    {outflow.balanceDue > 0 ? (
                                        <Badge variant="destructive">Rps {outflow.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Badge>
                                    ) : (
                                        <Badge variant="secondary">Paid</Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex justify-center gap-1">
                                    {outflow.balanceDue > 0 && (
                                      <Button variant="secondary" size="sm" onClick={() => handlePayDuesClick(outflow)} title="Pay Dues">
                                          Pay
                                      </Button>
                                    )}
                                    <Button variant="ghost" size="icon" onClick={() => outflow.customer && outflow.location && outflow.cropType && generateInvoicePdf(outflow, outflow.customer, outflow.location, outflow.cropType, allAreas)} title="Download Outflow Invoice" disabled={!outflow.customer || !outflow.location || !outflow.cropType}>
                                        <FileDown className="h-5 w-5" />
                                        <span className="sr-only">Download Outflow Invoice</span>
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
                <FileText className="h-10 w-10 text-muted-foreground" />
                <p className="mt-4 text-sm text-muted-foreground">{searchTerm ? "No transactions match your search." : "No transactions found."}</p>
            </div>
            )}
        </CardContent>
      </Card>
      <PayDuesDialog 
        isOpen={isPayDuesOpen}
        setIsOpen={setIsPayDuesOpen}
        outflow={selectedOutflow}
      />
    </>
  );
}
