
"use client";

import { useMemo, useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileDown, Calendar, User, Search, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { useCollection, useFirebase, useMemoFirebase, useDoc } from "@/firebase";
import { collection, query, where, getDocs, doc } from "firebase/firestore";
import type { Outflow, Inflow, Customer, StorageLocation, CropType, StorageArea, UserProfile } from "@/lib/data";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { generateInvoicePdf, generateInflowPdf } from "@/lib/pdf";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PayDuesDialog } from "@/components/pay-dues-dialog";

type Transaction = (Inflow | Outflow) & { type: 'Inflow' | 'Outflow' };

function toDate(dateValue: any): Date {
    if (!dateValue) return new Date();
    if (dateValue && typeof dateValue.seconds === 'number' && typeof dateValue.nanoseconds === 'number') {
        return new Date(dateValue.seconds * 1000 + dateValue.nanoseconds / 1000000);
    }
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return new Date();
    return date;
}

export default function TransactionsPage() {
  const { firestore, user } = useFirebase();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOutflow, setSelectedOutflow] = useState<Outflow | null>(null);
  const [isPayDuesOpen, setIsPayDuesOpen] = useState(false);

  const userProfileRef = useMemoFirebase(() => 
    user ? doc(firestore, 'users', user.uid) : null
  , [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  const outflowsQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const baseQuery = collection(firestore, 'outflows');
    if (userProfile.role === 'admin') {
      return baseQuery;
    }
    return query(baseQuery, where('ownerId', '==', user.uid));
  }, [firestore, user, userProfile]);

  const inflowsQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const baseQuery = collection(firestore, 'inflows');
    if (userProfile.role === 'admin') {
      return baseQuery;
    }
    return query(baseQuery, where('ownerId', '==', user.uid));
  }, [firestore, user, userProfile]);

  const customersQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const baseQuery = collection(firestore, 'customers');
    if (userProfile.role === 'admin') {
      return baseQuery;
    }
    return query(baseQuery, where('ownerId', '==', user.uid));
  }, [firestore, user, userProfile]);

  const locationsQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const baseQuery = collection(firestore, 'storageLocations');
    if (userProfile.role === 'admin') {
      return baseQuery;
    }
    return query(baseQuery, where('ownerId', '==', user.uid));
  }, [firestore, user, userProfile]);

  const cropTypesQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const baseQuery = collection(firestore, 'cropTypes');
    if (userProfile.role === 'admin') {
      return baseQuery;
    }
    return query(baseQuery, where('ownerId', '==', user.uid));
  }, [firestore, user, userProfile]);

  const { data: outflows } = useCollection<Outflow>(outflowsQuery);
  const { data: inflows } = useCollection<Inflow>(inflowsQuery);
  const { data: customers } = useCollection<Customer>(customersQuery);
  const { data: locations } = useCollection<StorageLocation>(locationsQuery);
  const { data: cropTypes } = useCollection<CropType>(cropTypesQuery);
  
  const [allAreas, setAllAreas] = useState<StorageArea[]>([]);
  const [isLoadingAreas, setIsLoadingAreas] = useState(true);
  
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
  
  const transactions = useMemo((): Transaction[] => {
    if (!outflows || !inflows || !customers || !locations || !cropTypes) return [];

    const enrichedInflows = inflows.map(inflow => {
        const customer = customers.find(c => c.id === inflow.customerId);
        return {
            ...inflow,
            type: 'Inflow' as const,
            date: inflow.dateAdded,
            customerName: customer?.name || 'N/A',
            cropTypeName: inflow.cropType,
            quantity: inflow.areaAllocations.reduce((sum, alloc) => sum + alloc.quantity, 0),
        }
    });

    const enrichedOutflows = outflows.map(outflow => {
        const customer = customers.find(c => c.id === outflow.customerId);
        return {
            ...outflow,
            type: 'Outflow' as const,
            customerName: customer?.name || 'N/A',
        };
    });

    const combined = [...enrichedInflows, ...enrichedOutflows];

    return combined.filter(t => {
      const search = searchTerm.toLowerCase();
      return t.customerName.toLowerCase().includes(search) || t.cropTypeName.toLowerCase().includes(search);
    }).sort((a, b) => toDate(b.date).getTime() - toDate(a.date).getTime());

  }, [outflows, inflows, customers, locations, cropTypes, searchTerm]);


  const handlePayDuesClick = (outflow: Outflow) => {
    setSelectedOutflow(outflow);
    setIsPayDuesOpen(true);
  }

  const isLoading = !outflows || !inflows || !customers || !locations || !cropTypes || isLoadingAreas;
  
  const getFullData = (transaction: Transaction) => {
    const customer = customers?.find(c => c.id === transaction.customerId);
    const location = locations?.find(l => l.id === ('storageLocationId' in transaction ? transaction.storageLocationId : undefined) || l.name === ('locationName' in transaction ? transaction.locationName : undefined));
    const cropType = cropTypes?.find(ct => ct.name === transaction.cropTypeName);
    return { customer, location, cropType };
  }

  return (
    <>
      <PageHeader
        title="Transaction History"
        description="A complete log of all inflow and outflow transactions."
      />
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <CardTitle>All Transactions</CardTitle>
                <CardDescription>
                  {transactions?.length || 0} transactions found.
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
            ) : transactions && transactions.length > 0 ? (
            <>
                {/* Mobile View */}
                <div className="grid gap-4 md:hidden">
                    {transactions.map((t) => {
                        const { customer, location, cropType } = getFullData(t);
                        return (
                        <Card key={t.id} className="bg-muted/30">
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-base">{t.customerName}</CardTitle>
                                        <CardDescription>{t.cropTypeName}</CardDescription>
                                    </div>
                                    <Badge variant={t.type === 'Inflow' ? 'secondary' : 'outline'}>
                                        {t.type === 'Inflow' ? <ArrowUpCircle className="mr-2"/> : <ArrowDownCircle className="mr-2"/>}
                                        {t.type}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="flex justify-between font-semibold">
                                    <span>Quantity:</span>
                                    <span>{('quantity' in t ? t.quantity : t.quantityWithdrawn).toLocaleString()} bags</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Date:</span>
                                    <span>{format(toDate(t.date), "MMM d, yyyy")}</span>
                                </div>
                                {t.type === 'Outflow' && (
                                     <div className="flex justify-between items-center border-t pt-2 mt-2">
                                        <span className="text-base font-bold">Total Bill:</span>
                                        <span className="text-lg font-bold">{t.totalBill.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Rp</span>
                                    </div>
                                )}
                                {t.type === 'Outflow' && t.balanceDue > 0 && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-base font-bold text-destructive">Balance Due:</span>
                                        <span className="text-lg font-bold text-destructive">{t.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })} Rp</span>
                                    </div>
                                )}
                            </CardContent>
                             <CardFooter className="flex flex-col items-stretch gap-2">
                                {t.type === 'Inflow' && customer && location && cropType && (
                                    <Button variant="outline" size="sm" className="w-full" onClick={() => generateInflowPdf({...t, cropType}, customer, location, allAreas)}>
                                        <FileDown className="h-4 w-4 mr-2" />
                                        Download Receipt
                                    </Button>
                                )}
                                {t.type === 'Outflow' && customer && location && cropType && (
                                    <Button variant="outline" size="sm" onClick={() => generateInvoicePdf(t, customer, location, cropType, allAreas)} title="Download Outflow Invoice" className="w-full">
                                        <FileDown className="h-4 w-4 mr-2" />
                                        Download Invoice
                                    </Button>
                                )}
                                {t.type === 'Outflow' && t.balanceDue > 0 && (
                                    <Button size="sm" onClick={() => handlePayDuesClick(t)} className="w-full">
                                        Pay Dues
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    )})}
                </div>

                {/* Desktop View */}
                <div className="hidden md:block">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Crop Type</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                            <TableHead className="text-right">Bill / Status</TableHead>
                            <TableHead className="text-center">Action</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.map((t) => {
                                const { customer, location, cropType } = getFullData(t);
                                return (
                                <TableRow key={t.id}>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span>{format(toDate(t.date), "MMM d, yyyy")}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {formatDistanceToNow(toDate(t.date), { addSuffix: true })}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={t.type === 'Inflow' ? 'secondary' : 'outline'} className="whitespace-nowrap">
                                            {t.type === 'Inflow' ? <ArrowUpCircle className="mr-2"/> : <ArrowDownCircle className="mr-2"/>}
                                            {t.type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-medium">{t.customerName}</TableCell>
                                    <TableCell>{t.cropTypeName}</TableCell>
                                    <TableCell className="text-right">{('quantity' in t ? t.quantity : t.quantityWithdrawn).toLocaleString()} bags</TableCell>
                                    <TableCell className="text-right">
                                        {t.type === 'Outflow' ? (
                                            <div>
                                                <div className="font-semibold">{t.totalBill.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Rp</div>
                                                {t.balanceDue > 0 ? (
                                                    <Badge variant="destructive" className="mt-1">Due: {t.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })} Rp</Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="mt-1">Paid</Badge>
                                                )}
                                            </div>
                                        ) : (
                                            <Badge variant="outline">In Stock</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <div className="flex justify-center gap-1">
                                        {t.type === 'Outflow' && t.balanceDue > 0 && (
                                          <Button variant="secondary" size="sm" onClick={() => handlePayDuesClick(t)} title="Pay Dues">
                                              Pay
                                          </Button>
                                        )}
                                        {t.type === 'Inflow' && customer && location && cropType && (
                                            <Button variant="ghost" size="icon" onClick={() => generateInflowPdf({...t, cropType}, customer, location, allAreas)} title="Download Inflow Receipt">
                                                <FileDown className="h-5 w-5" />
                                                <span className="sr-only">Download Inflow Receipt</span>
                                            </Button>
                                        )}
                                        {t.type === 'Outflow' && customer && location && cropType && (
                                            <Button variant="ghost" size="icon" onClick={() => generateInvoicePdf(t, customer, location, cropType, allAreas)} title="Download Outflow Invoice">
                                                <FileDown className="h-5 w-5" />
                                                <span className="sr-only">Download Outflow Invoice</span>
                                            </Button>
                                        )}
                                      </div>
                                    </TableCell>
                                </TableRow>
                            )})}
                        </TableBody>
                    </Table>
                </div>
            </>
            ) : (
            <div className="h-64 flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 p-12 text-center">
                <User className="h-10 w-10 text-muted-foreground" />
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
