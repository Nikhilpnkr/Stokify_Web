"use client";

import { useState, useMemo } from "react";
import { initialCropBatches, initialStorageLocations, CropBatch, StorageLocation } from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Archive, Wheat } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

export default function ReportsPage() {
  const [batches] = useState<CropBatch[]>(initialCropBatches);
  const [locations] = useState<StorageLocation[]>(initialStorageLocations);
  
  const { totalBatches, totalQuantity, totalCost, totalCapacity, spaceUtilization, chartData } = useMemo(() => {
    const totalBatches = batches.length;
    const totalQuantity = batches.reduce((acc, b) => acc + b.quantity, 0);
    const totalCost = batches.reduce((acc, b) => acc + b.storageCost, 0);
    const totalCapacity = locations.reduce((acc, l) => acc + l.capacity, 0);
    const spaceUtilization = totalCapacity > 0 ? (totalQuantity / totalCapacity) * 100 : 0;

    const chartData = locations.map(location => {
      const used = batches
        .filter(b => b.locationId === location.id)
        .reduce((acc, b) => acc + b.quantity, 0);
      return {
        name: location.name,
        capacity: location.capacity,
        used: used,
      };
    });

    return { totalBatches, totalQuantity, totalCost, totalCapacity, spaceUtilization, chartData };
  }, [batches, locations]);

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
      />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Storage Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCost.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across {totalBatches} batches</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stored Quantity</CardTitle>
            <Archive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalQuantity.toLocaleString()} bags</div>
            <p className="text-xs text-muted-foreground">Across all locations</p>
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
            <p className="text-xs text-muted-foreground">Currently in storage</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Space Utilization by Location</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
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
                tickFormatter={(value) => `${value / 1000}k`}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--card))" }}
                content={<ChartTooltipContent />}
              />
              <Legend />
              <Bar dataKey="capacity" fill="var(--color-capacity)" radius={4} />
              <Bar dataKey="used" fill="var(--color-used)" radius={4} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </>
  );
}
