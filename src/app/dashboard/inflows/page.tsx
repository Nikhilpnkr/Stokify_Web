
"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Receipt, FileDown, MapPin, Calendar, Smartphone, Search, Archive } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, formatDistanceToNow } from "date-fns";
import { AddInflowDialog } from "@/components/add-inflow-dialog";
import { OutflowDialog } from "@/components/outflow-dialog";
import { useCollection, useFirebase, useUser, useMemoFirebase, useDoc } from "@/firebase";
import { collection, query, where, getDocs, doc } from "firebase/firestore";
import type { Inflow, StorageLocation, CropType, Customer, StorageArea, Outflow, UserProfile } from "@/lib/data";
import { generateInflowPdf } from "@/lib/pdf";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

function toDate(dateValue: any): Date {
    if (!dateValue) return new Date();
    // Handle Firestore Timestamp objects
    if (dateValue && typeof dateValue.seconds === 'number' && typeof dateValue.nanoseconds === 'number') {
        return new Date(dateValue.seconds * 1000 + dateValue.nanoseconds / 1000000);
    }
    // Handle ISO strings or other date formats
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
        console.warn("Invalid date value:", dateValue);
        return new Date(); // Return a valid date to prevent crashes
    }
    return date;
}

export default function InflowsPage() {
  const { firestore } = useFirebase();
  const { user } = useUser();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isOutflowDialogOpen, setIsOutflowDialogOpen] = useState(false);
  const [selectedInflow, setSelectedInflow] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const userProfileRef = useMemoFirebase(() => 
    user ? doc(firestore, 'users', user.uid) : null
  , [firestore, user]);
  const { data: userProfile, isLoading: isLoadingProfile } = useDoc<UserProfile>(userProfileRef);

  const inflowsQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const baseQuery = collection(firestore, 'inflows');
    if (userProfile.role === 'admin' || userProfile.role === 'manager') {
      return baseQuery;
    }
    return query(baseQuery, where('ownerId', '==', user.uid));
  }, [firestore, user, userProfile]);

  const storageLocationsQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const baseQuery = collection(firestore, 'storageLocations');
    if (userProfile.role === 'admin' || userProfile.role === 'manager') {
      return baseQuery;
    }
    return query(baseQuery, where('ownerId', '==', user.uid));
  }, [firestore, user, userProfile]);

  const cropTypesQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const baseQuery = collection(firestore, 'cropTypes');
    if (userProfile.role === 'admin' || userProfile.role === 'manager') {
      return baseQuery;
    }
    return query(baseQuery, where('ownerId', '==', user.uid));
  }, [firestore, user, userProfile]);

  const customersQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const baseQuery = collection(firestore, 'customers');
    if (userProfile.role === 'admin' || userProfile.role === 'manager') {
      return baseQuery;
    }
    return query(baseQuery, where('ownerId', '==', user.uid));
  }, [firestore, user, userProfile]);
  
   const outflowsQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const baseQuery = collection(firestore, 'outflows');
    if (userProfile.role === 'admin' || userProfile.role === 'manager') {
      return baseQuery;
    }
    return query(baseQuery, where('ownerId', '==', user.uid));
  }, [firestore, user, userProfile]);

  const { data: rawInflows, isLoading: isLoadingInflows } = useCollection<Inflow>(inflowsQuery);
  const { data: locations, isLoading: isLoadingLocations } = useCollection<StorageLocation>(storageLocationsQuery);
  const { data: cropTypes, isLoading: isLoadingCropTypes } = useCollection<CropType>(cropTypesQuery);
  const { data: customers, isLoading: isLoadingCustomers } = useCollection<Customer>(customersQuery);
  const { data: outflows, isLoading: isLoadingOutflows } = useCollection<Outflow>(outflowsQuery);

  const [allAreas, setAllAreas] = useState<StorageArea[]>([]);
  const [isLoadingAreas, setIsLoadingAreas] = useState(false);

  useEffect(() => {
    async function fetchAllAreas() {
      if (!locations || locations.length === 0 || !firestore) {
        setAllAreas([]);
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
    if (!rawInflows || !outflows || !customers || !locations || !cropTypes) return [];
    
    return rawInflows.map(inflow => {
      const outflow = outflows.find(o => o.inflowId === inflow.id);
      const customer = customers.find(c => c.id === inflow.customerId);
      const location = locations.find(l => l.id === inflow.storageLocationId);
      const cropType = cropTypes.find(ct => ct.name === inflow.cropType);
      
      return {
        ...inflow,
        customer,
        location,
        cropType: cropType,
        quantity: inflow.areaAllocations?.reduce((sum, alloc) => sum + alloc.quantity, 0) || 0,
        outflow,
      }
    }).filter(inflow => {
        return (inflow.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
               (inflow.cropType?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    }).sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
  }, [rawInflows, outflows, customers, locations, cropTypes, searchTerm]);

  const getAreaNames = (allocations: {areaId: string, quantity: number}[]) => {
    if (!allAreas || allAreas.length === 0) return '...';
    return allocations.map(alloc => allAreas.find(a => a.id === alloc.areaId)?.name).filter(Boolean).join(', ') || 'N/A';
  }

  const handleOutflowClick = (inflow: any) => {
    setSelectedInflow(inflow);
    setIsOutflowDialogOpen(true);
  };
  
  const handleDownloadInflowReceipt = (inflow: (typeof inflows)[0]) => {
    if (inflow.customer && inflow.location && inflow.cropType) {
      generateInflowPdf(inflow, inflow.customer, inflow.location, allAreas);
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not find all necessary data to generate receipt.",
      });
    }
  };

  const isLoading = isLoadingProfile || isLoadingInflows || isLoadingLocations || isLoadingCropTypes || isLoadingCustomers || isLoadingAreas || isLoadingOutflows;

  return (
    <>
      <PageHeader
        title="Inventory"
        description="A list of all crop inflows currently in storage."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsAddDialogOpen(true)} disabled={!user}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add New Inflow
            </Button>
          </div>
        }
      />
      
      <Card>
        <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <CardTitle>Current Inventory</CardTitle>
                <CardDescription>A list of all crop inflows currently in storage. Click the receipt icon to process outflow.</CardDescription>
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
          ) : inflows && inflows.length > 0 ? (
            <>
              {/* Mobile View: Card List */}
              <div className="grid gap-4 md:hidden">
                {inflows.map((inflow) => (
                  <Card key={inflow.id} className="bg-muted/30">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                           <CardTitle>{inflow.customer?.name || '...'}</CardTitle>
                           <CardDescription>{inflow.cropType?.name}</CardDescription>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold">{inflow.quantity.toLocaleString()} bags</p>
                          <p className="text-xs text-muted-foreground">In Stock</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2"><Smartphone className="h-4 w-4" /><span>{inflow.customer?.mobileNumber || '...'}</span></div>
                      <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /><span>{inflow.location?.name} ({getAreaNames(inflow.areaAllocations)})</span></div>
                      <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /><span>{format(toDate(inflow.dateAdded), "MMM d, yyyy")}</span></div>
                    </CardContent>
                    <CardFooter className="flex justify-between">
                        <Button variant="outline" size="sm" onClick={() => handleOutflowClick(inflow)} title="Process Outflow">
                            <Receipt className="h-5 w-5 mr-2" />
                            Outflow
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => handleDownloadInflowReceipt(inflow)} title="Download Inflow Receipt">
                            <FileDown className="h-5 w-5 mr-2" />
                            Receipt
                        </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
              {/* Desktop View: Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Crop Type</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Area(s)</TableHead>
                      <TableHead className="text-right">Quantity (bags)</TableHead>
                      <TableHead>Date Added</TableHead>
                      <TableHead className="text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inflows.map((inflow) => (
                      <TableRow key={inflow.id}>
                        <TableCell className="font-medium">{inflow.customer?.name || '...'}</TableCell>
                        <TableCell>{inflow.customer?.mobileNumber || '...'}</TableCell>
                        <TableCell>{inflow.cropType?.name}</TableCell>
                        <TableCell>{inflow.location?.name || '...'}</TableCell>
                        <TableCell>{getAreaNames(inflow.areaAllocations)}</TableCell>
                        <TableCell className="text-right">{inflow.quantity.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{format(toDate(inflow.dateAdded), "MMM d, yyyy")}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(toDate(inflow.dateAdded), { addSuffix: true })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleOutflowClick(inflow)} title="Process Outflow">
                                <Receipt className="h-5 w-5" />
                                <span className="sr-only">Process Outflow for {inflow.customer?.name}</span>
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDownloadInflowReceipt(inflow)} title="Download Inflow Receipt">
                                <FileDown className="h-5 w-5" />
                                <span className="sr-only">Download Inflow Receipt</span>
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
            <div className="h-64 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 p-12 text-center">
                <Archive className="h-10 w-10 text-muted-foreground" />
                <p className="mt-4 text-sm text-muted-foreground">{searchTerm ? "No inflows match your search." : "No crop inflows found."}</p>
            </div>
          )}
        </CardContent>
      </Card>
      <AddInflowDialog
        isOpen={isAddDialogOpen}
        setIsOpen={setIsAddDialogOpen}
        locations={locations || []}
        cropTypes={cropTypes || []}
        customers={customers || []}
        allInflows={rawInflows || []}
      />
      {selectedInflow && (
        <OutflowDialog
            isOpen={isOutflowDialogOpen}
            setIsOpen={setIsOutflowDialogOpen}
            inflow={selectedInflow}
            cropType={selectedInflow.cropType}
            locations={locations || []}
            allAreas={allAreas}
        />
      )}
    </>
  );
}
