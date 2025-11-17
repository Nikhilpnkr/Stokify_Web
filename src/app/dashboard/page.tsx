
"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Users, Archive, Banknote } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { useCollection, useFirebase, useUser, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import type { CropBatch, StorageLocation, Customer, Outflow } from "@/lib/data";
import Link from "next/link";


export default function DashboardPage() {
  const { firestore } = useFirebase();
  const { user } = useUser();

  const cropBatchesQuery = useMemoFirebase(() =>
    user ? query(collection(firestore, 'cropBatches'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );
  const storageLocationsQuery = useMemoFirebase(() =>
    user ? query(collection(firestore, 'storageLocations'), where('ownerId', '==', user.uid)) : null,
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
  const { data: customers, isLoading: isLoadingCustomers } = useCollection<Customer>(customersQuery);
  const { data: outflows, isLoading: isLoadingOutflows } = useCollection<Outflow>(outflowsQuery);

  const { totalQuantity, totalOutstandingBalance, chartData } = useMemo(() => {
    if (!rawBatches || !locations) {
      return { totalQuantity: 0, totalOutstandingBalance: 0, chartData: [] };
    }

    const totalQty = rawBatches.reduce((acc, b) => {
        const batchQty = b.areaAllocations?.reduce((sum, alloc) => sum + alloc.quantity, 0) || 0;
        return acc + batchQty;
    }, 0);

    const outstanding = outflows?.reduce((acc, o) => acc + o.balanceDue, 0) || 0;

    const dataForChart = locations.map(location => {
      const used = rawBatches
        .filter(b => b.storageLocationId === location.id)
        .reduce((acc, b) => acc + (b.areaAllocations?.reduce((s, a) => s + a.quantity, 0) || 0), 0);
      return {
        name: location.name,
        capacity: location.capacity,
        used: used,
      };
    });

    return { totalQuantity: totalQty, totalOutstandingBalance: outstanding, chartData: dataForChart };
  }, [rawBatches, locations, outflows]);
  
  const isLoading = isLoadingBatches || isLoadingLocations || isLoadingCustomers || isLoadingOutflows;
  
  const chartConfig = {
    capacity: {
      label: "Capacity",
      color: "hsl(var(--muted))",
    },
    used: {
      label: "Used",
      color: "hsl(var(--primary))",
    },
  } satisfies ChartConfig;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="An overview of your crop inventory and business metrics."
        action={
          <Button asChild>
            <Link href="/dashboard/inventory">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add New Batch
            </Link>
          </Button>
        }
      />
      
      {isLoading ? (
          <div className="flex items-center justify-center h-96">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
      ) : (
        <div className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
                    <div className="text-2xl font-bold">Rps {totalOutstandingBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
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
                <CardTitle>Space Utilization by Location</CardTitle>
                </CardHeader>
                <CardContent>
                <ChartContainer config={chartConfig} className="min-h-[200px] sm:min-h-[300px] w-full">
                    <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData} accessibilityLayer>
                        <XAxis
                        dataKey="name"
                        tickLine={false}
                        tickMargin={10}
                        axisLine={false}
                        stroke="hsl(var(--foreground))"
                        fontSize={12}
                        />
                        <YAxis
                        stroke="hsl(var(--foreground))"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${Number(value) / 1000}k`}
                        />
                        <Tooltip
                        cursor={{ fill: "hsl(var(--card))" }}
                        content={<ChartTooltipContent />}
                        />
                        <Legend />
                        <Bar dataKey="capacity" fill="var(--color-capacity)" radius={4} />
                        <Bar dataKey="used" fill="var(--color-used)" radius={4} />
                    </BarChart>
                    </ResponsiveContainer>
                </ChartContainer>
                </CardContent>
            </Card>
        </div>
      )}
    </>
  );
}
