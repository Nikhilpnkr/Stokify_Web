
"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Receipt, Users, Archive, Banknote, FileDown, MapPin, Calendar, Smartphone, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, formatDistanceToNow } from "date-fns";
import { AddBatchDialog } from "@/components/add-batch-dialog";
import { OutflowDialog } from "@/components/outflow-dialog";
import { useCollection, useFirebase, useUser, useMemoFirebase } from "@/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { CropBatch, StorageLocation, CropType, Customer, StorageArea, Outflow } from "@/lib/data";
import { generateInvoicePdf } from "@/lib/pdf";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";


export default function InventoryPage() {
  const { firestore } = useFirebase();
  const { user } = useUser();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isOutflowDialogOpen, setIsOutflowDialogOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<CropBatch | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const cropBatchesQuery = useMemoFirebase(() =>
    user ? query(collection(firestore, 'cropBatches'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );
  const storageLocationsQuery = useMemoFirebase(() =>
    user ? query(collection(firestore, 'storageLocations'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );
  const cropTypesQuery = useMemoFirebase(() =>
    user ? query(collection(firestore, 'cropTypes'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );
  const customersQuery = useMemoFirebase(() =>
    user ? query(collection(firestore, 'customers'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );
   const outflowsQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, 'outflows'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );

  const { data: rawBatches, isLoading: isLoadingBatches } = useCollection<CropBatch>(cropBatchesQuery);
  const { data: locations, isLoading: isLoadingLocations } = useCollection<StorageLocation>(storageLocationsQuery);
  const { data: cropTypes, isLoading: isLoadingCropTypes } = useCollection<CropType>(cropTypesQuery);
  const { data: customers, isLoading: isLoadingCustomers } = useCollection<Customer>(customersQuery);
  const { data: outflows, isLoading: isLoadingOutflows } = useCollection<Outflow>(outflowsQuery);

  const [allAreas, setAllAreas] = useState<StorageArea[]>([]);
  const [isLoadingAreas, setIsLoadingAreas] = useState(false);
  
  const { totalQuantity, totalOutstandingBalance } = useMemo(() => {
    const totalQty = rawBatches?.reduce((acc, b) => {
        const batchQty = b.areaAllocations?.reduce((sum, alloc) => sum + alloc.quantity, 0) || 0;
        return acc + batchQty;
    }, 0) || 0;

    const outstanding = outflows?.reduce((acc, o) => acc + o.balanceDue, 0) || 0;

    return { totalQuantity: totalQty, totalOutstandingBalance: outstanding };
  }, [rawBatches, outflows]);


  // Fetch all areas from all locations
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

  const batches = useMemo(() => {
    if (!rawBatches || !outflows || !customers || !locations || !cropTypes) return [];
    
    const filteredBatches = rawBatches.filter(batch => 
        batch.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        batch.cropType.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return filteredBatches.map(batch => {
      const outflow = outflows.find(o => o.cropBatchId === batch.id);
      const customer = customers.find(c => c.id === batch.customerId);
      const location = locations.find(l => l.id === batch.storageLocationId);
      const cropType = cropTypes.find(ct => ct.name === batch.cropType);
      
      return {
        ...batch,
        quantity: batch.areaAllocations?.reduce((sum, alloc) => sum + alloc.quantity, 0) || 0,
        outflow,
        customer,
        location,
        cropType,
      }
    }).sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
  }, [rawBatches, outflows, customers, locations, cropTypes, searchTerm]);

  const getAreaNames = (allocations: {areaId: string, quantity: number}[]) => {
    if (!allAreas || allAreas.length === 0) return '...';
    return allocations.map(alloc => allAreas.find(a => a.id === alloc.areaId)?.name).filter(Boolean).join(', ') || 'N/A';
  }

  const handleOutflowClick = (batch: CropBatch) => {
    setSelectedBatch(batch);
    setIsOutflowDialogOpen(true);
  };
  
  const handleDownloadInvoice = (batch: (typeof batches)[0]) => {
    if (batch.outflow && batch.customer && batch.location && batch.cropType) {
      generateInvoicePdf(batch.outflow, batch.customer, batch.location, batch.cropType);
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not find all necessary data to generate invoice.",
      });
    }
  };

  const isLoading = isLoadingBatches || isLoadingLocations || isLoadingCropTypes || isLoadingCustomers || isLoadingAreas || isLoadingOutflows;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="An overview of your crop inventory and business metrics."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsAddDialogOpen(true)} disabled={!user}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add New Batch
            </Button>
          </div>
        }
      />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stored Quantity</CardTitle>
            <Archive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalQuantity.toLocaleString()} bags</div>
            <p className="text-xs text-muted-foreground">Across {locations?.length || 0} locations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Currently storing crops</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Outstanding Balance</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalOutstandingBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
            <p className="text-xs text-muted-foreground">Across all transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Crop Batches</CardTitle>
            <div className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rawBatches?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Currently in storage</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <CardTitle>Current Inventory</CardTitle>
                <CardDescription>A list of all crop batches currently in storage. Click the receipt icon to process outflow.</CardDescription>
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
          ) : batches && batches.length > 0 ? (
            <>
              {/* Mobile View: Card List */}
              <div className="grid gap-4 md:hidden">
                {batches.map((batch) => (
                  <Card key={batch.id} className="bg-muted/30">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                           <CardTitle>{batch.customerName}</CardTitle>
                           <CardDescription>{batch.cropType}</CardDescription>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold">{batch.quantity.toLocaleString()} bags</p>
                          <p className="text-xs text-muted-foreground">In Stock</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2"><Smartphone className="h-4 w-4" /><span>{batch.customer?.mobileNumber || '...'}</span></div>
                      <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /><span>{batch.location?.name} ({getAreaNames(batch.areaAllocations)})</span></div>
                      <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /><span>{format(toDate(batch.dateAdded), "MMM d, yyyy")}</span></div>
                    </CardContent>
                    <CardFooter className="flex justify-between">
                        <Button variant="outline" size="sm" onClick={() => handleOutflowClick(batch)} title="Process Outflow">
                            <Receipt className="h-5 w-5 mr-2" />
                            Outflow
                        </Button>
                        {batch.outflow && (
                            <Button variant="secondary" size="sm" onClick={() => handleDownloadInvoice(batch)} title="Download Invoice">
                                <FileDown className="h-5 w-5 mr-2" />
                                Invoice
                            </Button>
                        )}
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
                    {batches.map((batch) => (
                      <TableRow key={batch.id}>
                        <TableCell className="font-medium">{batch.customerName}</TableCell>
                        <TableCell>{batch.customer?.mobileNumber || '...'}</TableCell>
                        <TableCell>{batch.cropType}</TableCell>
                        <TableCell>{batch.location?.name || '...'}</TableCell>
                        <TableCell>{getAreaNames(batch.areaAllocations)}</TableCell>
                        <TableCell className="text-right">{batch.quantity.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{format(toDate(batch.dateAdded), "MMM d, yyyy")}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(toDate(batch.dateAdded), { addSuffix: true })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleOutflowClick(batch)} title="Process Outflow">
                                <Receipt className="h-5 w-5" />
                                <span className="sr-only">Process Outflow for {batch.customerName}</span>
                            </Button>
                             {batch.outflow && (
                                <Button variant="ghost" size="icon" onClick={() => handleDownloadInvoice(batch)} title="Download Invoice">
                                    <FileDown className="h-5 w-5" />
                                    <span className="sr-only">Download Invoice</span>
                                </Button>
                            )}
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
                <p className="text-sm text-muted-foreground">{searchTerm ? "No batches match your search." : "No crop batches found."}</p>
            </div>
          )}
        </CardContent>
      </Card>
      <AddBatchDialog
        isOpen={isAddDialogOpen}
        setIsOpen={setIsAddDialogOpen}
        locations={locations || []}
        cropTypes={cropTypes || []}
        customers={customers || []}
        allBatches={rawBatches || []}
      />
      {selectedBatch && (
        <OutflowDialog
            isOpen={isOutflowDialogOpen}
            setIsOpen={setIsOutflowDialogOpen}
            batch={selectedBatch}
            cropType={cropTypes?.find(ct => ct.name === selectedBatch.cropType)}
            locations={locations || []}
        />
      )}
    </>
  );
}

function toDate(dateValue: any): Date {
    if (!dateValue) return new Date();
    if (dateValue && typeof dateValue.seconds === 'number' && typeof dateValue.nanoseconds === 'number') {
        return new Date(dateValue.seconds * 1000 + dateValue.nanoseconds / 1000000);
    }
    return new Date(dateValue);
}

    