
"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, Wrench, Calendar, User } from "lucide-react";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import type { Inflow, Customer } from "@/lib/data";
import { format, formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";

function toDate(dateValue: any): Date {
    if (!dateValue) return new Date();
    if (dateValue && typeof dateValue.seconds === 'number' && typeof dateValue.nanoseconds === 'number') {
        return new Date(dateValue.seconds * 1000 + dateValue.nanoseconds / 1000000);
    }
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return new Date();
    return date;
}

export default function LabourPage() {
  const { firestore, user } = useFirebase();
  const [searchTerm, setSearchTerm] = useState("");

  const inflowsQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, 'inflows'), where('ownerId', '==', user.uid), where('labourCharge', '>', 0)) : null,
    [firestore, user]
  );
  const { data: inflows, isLoading: isLoadingInflows } = useCollection<Inflow>(inflowsQuery);

  const customersQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, 'customers'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );
  const { data: customers, isLoading: isLoadingCustomers } = useCollection<Customer>(customersQuery);

  const enrichedInflows = useMemo(() => {
    if (!inflows || !customers) return [];

    return inflows.map(inflow => {
        const customer = customers.find(c => c.id === inflow.customerId);
        return {
            ...inflow,
            customerName: customer?.name || 'N/A',
        }
    }).filter(inflow => {
        const search = searchTerm.toLowerCase();
        return inflow.customerName.toLowerCase().includes(search) || inflow.cropType.toLowerCase().includes(search);
    }).sort((a, b) => toDate(b.dateAdded).getTime() - toDate(a.dateAdded).getTime());

  }, [inflows, customers, searchTerm]);

  const totalLabourCharges = useMemo(() => {
    return enrichedInflows.reduce((sum, inflow) => sum + (inflow.labourCharge || 0), 0);
  }, [enrichedInflows]);


  const isLoading = isLoadingInflows || isLoadingCustomers;

  return (
    <>
      <PageHeader
        title="Labour Charges"
        description="A record of all labour charges associated with crop inflows."
      />
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <CardTitle>Labour Charge History</CardTitle>
                <CardDescription>
                  Found {enrichedInflows?.length || 0} records. Total: {totalLabourCharges.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} Rp
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
            ) : enrichedInflows && enrichedInflows.length > 0 ? (
            <>
                {/* Mobile View */}
                <div className="grid gap-4 md:hidden">
                    {enrichedInflows.map((inflow) => (
                      <Card key={inflow.id} className="bg-muted/30">
                          <CardHeader>
                              <div className="flex justify-between items-start">
                                  <div>
                                      <CardTitle className="text-base">{inflow.customerName}</CardTitle>
                                      <CardDescription>{inflow.cropType}</CardDescription>
                                  </div>
                                  <div className="text-right">
                                      <p className="text-lg font-bold">{(inflow.labourCharge || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} Rp</p>
                                  </div>
                              </div>
                          </CardHeader>
                          <CardContent>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Calendar className="h-4 w-4" />
                                <span>{format(toDate(inflow.dateAdded), "MMM d, yyyy")}</span>
                              </div>
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
                            <TableHead>Crop Type</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                            <TableHead className="text-right">Labour Charge</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                            {enrichedInflows.map((inflow) => (
                              <TableRow key={inflow.id}>
                                  <TableCell>
                                      <div className="flex flex-col">
                                          <span>{format(toDate(inflow.dateAdded), "MMM d, yyyy")}</span>
                                          <span className="text-xs text-muted-foreground">
                                              {formatDistanceToNow(toDate(inflow.dateAdded), { addSuffix: true })}
                                          </span>
                                      </div>
                                  </TableCell>
                                  <TableCell className="font-medium">{inflow.customerName}</TableCell>
                                  <TableCell>{inflow.cropType}</TableCell>
                                  <TableCell className="text-right">{inflow.quantity.toLocaleString()} bags</TableCell>
                                  <TableCell className="text-right font-semibold">{(inflow.labourCharge || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Rp</TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </>
            ) : (
            <div className="h-64 flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 p-12 text-center">
                <Wrench className="h-10 w-10 text-muted-foreground" />
                <p className="mt-4 text-sm text-muted-foreground">{searchTerm ? "No records match your search." : "No labour charges found."}</p>
            </div>
            )}
        </CardContent>
      </Card>
    </>
  );
}
