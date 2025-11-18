
"use client";

import { useMemo, useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Archive, Wheat, Loader2, Calendar as CalendarIcon } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { useCollection, useFirebase, useUser, useMemoFirebase } from "@/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { CropBatch, StorageLocation, CropType, StorageArea } from "@/lib/data";
import { addDays, format, startOfMonth } from "date-fns";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export default function ReportsPage() {
  const { firestore } = useFirebase();
  const { user } = useUser();
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: new Date(),
  });

  const locationsQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, 'storageLocations'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );
  const batchesQuery = useMemoFirebase(() =>
    user ? query(collection(firestore, 'cropBatches'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );
  const cropTypesQuery = useMemoFirebase(() =>
    user ? query(collection(firestore, 'cropTypes'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );

  const { data: locations, isLoading: isLoadingLocations } = useCollection<StorageLocation>(locationsQuery);
  const { data: allBatches, isLoading: isLoadingBatches } = useCollection<CropBatch>(batchesQuery);
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

  const filteredBatches = useMemo(() => {
    if (!allBatches) return [];
    return allBatches.filter(batch => {
      const batchDate = new Date(batch.dateAdded);
      const from = date?.from ? new Date(date.from.setHours(0,0,0,0)) : null;
      const to = date?.to ? new Date(date.to.setHours(23,59,59,999)): null;

      if (from && batchDate < from) return false;
      if (to && batchDate > to) return false;
      return true;
    });
  }, [allBatches, date]);


  const { totalBatches, totalQuantity, potentialMonthlyRevenue, totalCapacity, spaceUtilization, chartData } = useMemo(() => {
    const batches = filteredBatches;
    if (!batches || !locations || !cropTypes || isLoadingAreas) {
      return { totalBatches: 0, totalQuantity: 0, potentialMonthlyRevenue: 0, totalCapacity: 0, spaceUtilization: 0, chartData: [] };
    }

    const totalBatches = batches.length;
    
    const totalQuantity = batches.reduce((acc, b) => {
        const batchQty = b.areaAllocations?.reduce((sum, alloc) => sum + alloc.quantity, 0) || 0;
        return acc + batchQty;
    }, 0);
    
    const potentialMonthlyRevenue = batches.reduce((acc, b) => {
        const cropType = cropTypes.find(ct => ct.name === b.cropType);
        if (!cropType) return acc;

        const batchQty = b.areaAllocations?.reduce((sum, alloc) => sum + alloc.quantity, 0) || 0;
        const monthlyRate = cropType.rates['1'];

        return acc + (batchQty * monthlyRate);
    }, 0);

    const totalCapacity = allAreas.reduce((acc, area) => acc + area.capacity, 0);
    const spaceUtilization = totalCapacity > 0 ? (totalQuantity / totalCapacity) * 100 : 0;

    const chartData = locations.map(location => {
        const locationAreas = allAreas.filter(a => a.storageLocationId === location.id);
        const capacity = locationAreas.reduce((acc, area) => acc + area.capacity, 0);
      const used = batches
        .filter(b => b.storageLocationId === location.id)
        .reduce((acc, b) => acc + (b.areaAllocations?.reduce((s, a) => s + a.quantity, 0) || 0), 0);
      return {
        name: location.name,
        capacity: capacity,
        used: used,
      };
    });

    return { totalBatches, totalQuantity, potentialMonthlyRevenue, totalCapacity, spaceUtilization, chartData };
  }, [filteredBatches, locations, cropTypes, allAreas, isLoadingAreas]);
  
  const isLoading = isLoadingLocations || isLoadingBatches || isLoadingCropTypes || isLoadingAreas;

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
        title="Storage Reports"
        description="An overview of your storage costs and space utilization."
        action={
            <div className="grid gap-2">
                <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                        "w-full sm:w-[300px] justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                        date.to ? (
                            <>
                            {format(date.from, "LLL dd, y")} -{" "}
                            {format(date.to, "LLL dd, y")}
                            </>
                        ) : (
                            format(date.from, "LLL dd, y")
                        )
                        ) : (
                        <span>Pick a date</span>
                        )}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={setDate}
                        numberOfMonths={2}
                    />
                    </PopoverContent>
                </Popover>
            </div>
        }
      />
       {isLoading ? (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Potential Monthly Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{potentialMonthlyRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} Rps</div>
                <p className="text-xs text-muted-foreground">From batches in date range</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Stored Quantity</CardTitle>
                <Archive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalQuantity.toLocaleString()} bags</div>
                <p className="text-xs text-muted-foreground">From batches in date range</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overall Space Utilization</CardTitle>
                <Wheat className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{spaceUtilization.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">
                  {totalQuantity.toLocaleString()} / {totalCapacity.toLocaleString()} bags used
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Crop Batches</CardTitle>
                <div className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalBatches}</div>
                <p className="text-xs text-muted-foreground">Added in date range</p>
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
        </>
      )}
    </>
  );
}
