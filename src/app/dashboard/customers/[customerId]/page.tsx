
"use client";

import { useMemo, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirebase, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { doc, collection, query, where, getDocs } from "firebase/firestore";
import type { Customer, Inflow, StorageLocation, StorageArea, CropType, Outflow } from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { Loader2, User, Phone, Calendar, Archive, Banknote } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, formatDistanceToNow } from "date-fns";
import { OutflowDialog } from "@/components/outflow-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";


export default function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const router = useRouter();
  const { firestore, user } = useFirebase();

  const [selectedInflow, setSelectedInflow] = useState<Inflow | null>(null);
  const [isOutflowDialogOpen, setIsOutflowDialogOpen] = useState(false);
  
  // Document reference for the specific customer
  const customerRef = useMemoFirebase(() =>
    customerId ? doc(firestore, 'customers', customerId) : null,
    [firestore, customerId]
  );
  const { data: customer, isLoading: isLoadingCustomer } = useDoc<Customer>(customerRef);

  // Query for all crop inflows for this customer
  const inflowsQuery = useMemoFirebase(() => 
    (user && customerId) ? query(collection(firestore, 'inflows'), where('customerId', '==', customerId), where('ownerId', '==', user.uid)) : null,
    [firestore, user, customerId]
  );
  const { data: rawInflows, isLoading: isLoadingInflows } = useCollection<Inflow>(inflowsQuery);
  
  const outflowsQuery = useMemoFirebase(() =>
    (user && customerId) ? query(collection(firestore, 'outflows'), where('customerId', '==', customerId), where('ownerId', '==', user.uid)) : null,
    [firestore, user, customerId]
  );
  const { data: outflows, isLoading: isLoadingOutflows } = useCollection<Outflow>(outflowsQuery);

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

  const inflows = useMemo(() => {
    if (!rawInflows) return [];
    return rawInflows.map(inflow => ({
      ...inflow,
      quantity: inflow.areaAllocations?.reduce((sum, alloc) => sum + alloc.quantity, 0) || 0,
    })).sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
  }, [rawInflows]);

  const totalBalanceDue = useMemo(() => {
    if (!outflows) return 0;
    return outflows.reduce((acc, outflow) => acc + outflow.balanceDue, 0);
  }, [outflows]);

  const getLocationName = (locationId: string) => locations?.find(l => l.id === locationId)?.name || '...';
  const getAreaNames = (allocations: {areaId: string, quantity: number}[]) => {
    if (!allAreas || allAreas.length === 0) return '...';
    return allocations.map(alloc => allAreas.find(a => a.id === alloc.areaId)?.name).filter(Boolean).join(', ') || 'N/A';
  }
  
  const handleRowClick = (inflow: Inflow) => {
    setSelectedInflow(inflow);
    setIsOutflowDialogOpen(true);
  };
  
  const handlePayDues = () => {
    router.push(`/dashboard/customers/${customerId}/pay`);
  };

  const isLoading = isLoadingCustomer || isLoadingInflows || isLoadingLocations || isLoadingAreas || isLoadingCropTypes || isLoadingOutflows;

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
        title={customer.name}
        description="A summary of all inflows stored by this customer."
      />
      
      <div className="grid gap-6">
        {/* Customer Details Cards */}
        <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <User className="h-6 w-6 text-primary" />
                            <span>Customer Details</span>
                        </CardTitle>
                    </div>
                     <div className="pt-2 space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          <span>{customer.mobileNumber}</span>
                        </div>
                    </div>
                </CardHeader>
            </Card>
            <Card className={cn("flex flex-col justify-between", totalBalanceDue > 0 ? "bg-destructive/10 border-destructive" : "")}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <Banknote className="h-6 w-6 text-primary"/>
                        <span>Outstanding Dues</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-3xl font-bold">
                        {totalBalanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })} Rp
                    </p>
                </CardContent>
                {totalBalanceDue > 0 && (
                    <CardFooter>
                        <Button className="w-full" onClick={handlePayDues}>
                            <Banknote className="mr-2 h-4 w-4" />
                            Pay Dues
                        </Button>
                    </CardFooter>
                )}
            </Card>
        </div>


        {/* Inflows Section */}
        <Card>
            <CardHeader>
                <CardTitle>Stored Inflows</CardTitle>
                <CardDescription>
                    {inflows?.length || 0} active inflows found for this customer.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center h-48">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : inflows && inflows.length > 0 ? (
                    <>
                    {/* Mobile View */}
                    <div className="grid gap-4 md:hidden">
                        {inflows.map((inflow) => (
                            <Card key={inflow.id} onClick={() => handleRowClick(inflow)} className="cursor-pointer bg-muted/30">
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle>{inflow.cropType}</CardTitle>
                                            <CardDescription>
                                                {getLocationName(inflow.storageLocationId)} ({getAreaNames(inflow.areaAllocations)})
                                            </CardDescription>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xl font-bold">{inflow.quantity.toLocaleString()} bags</p>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardFooter>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Calendar className="h-4 w-4" />
                                        <span>Added {formatDistanceToNow(new Date(inflow.dateAdded), { addSuffix: true })}</span>
                                    </div>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>

                    {/* Desktop View */}
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                            <TableRow>
                                <TableHead>Crop Type</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Area(s)</TableHead>
                                <TableHead className="text-right">Quantity (bags)</TableHead>
                                <TableHead>Date Added</TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {inflows.map((inflow) => (
                                <TableRow key={inflow.id} onClick={() => handleRowClick(inflow)} className="cursor-pointer">
                                <TableCell>{inflow.cropType}</TableCell>
                                <TableCell>{getLocationName(inflow.storageLocationId)}</TableCell>
                                <TableCell>{getAreaNames(inflow.areaAllocations)}</TableCell>
                                <TableCell className="text-right">{inflow.quantity.toLocaleString()}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                    <span>{format(new Date(inflow.dateAdded), "MMM d, yyyy")}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(inflow.dateAdded), { addSuffix: true })}
                                    </span>
                                    </div>
                                </TableCell>
                                </TableRow>
                            ))}
                            </TableBody>
                        </Table>
                    </div>
                    </>
                ) : (
                    <div className="h-48 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 p-12 text-center">
                        <Archive className="h-10 w-10 text-muted-foreground" />
                        <p className="mt-4 text-sm text-muted-foreground">No crop inflows found for this customer.</p>
                    </div>
                )}
            </CardContent>
        </Card>
      </div>
      {selectedInflow && (
        <OutflowDialog
            isOpen={isOutflowDialogOpen}
            setIsOpen={setIsOutflowDialogOpen}
            inflow={selectedInflow}
            cropType={cropTypes?.find(ct => ct.name === selectedInflow.cropType)}
            locations={locations || []}
            allAreas={allAreas}
        />
      )}
    </>
  );
}

    