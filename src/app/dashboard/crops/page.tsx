
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useCollection, useFirebase, useMemoFirebase, addDocumentNonBlocking } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import type { CropType } from "@/lib/data";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const cropTypeFormSchema = z.object({
  name: z.string().min(2, "Crop name must be at least 2 characters."),
  rate1: z.coerce.number().min(0, "Rate must be a positive number."),
  rate6: z.coerce.number().min(0, "Rate must be a positive number."),
  rate12: z.coerce.number().min(0, "Rate must be a positive number."),
});

export default function CropTypesManagerPage() {
  const { firestore, user } = useFirebase();
  const { toast } = useToast();
  
  const cropTypesQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, 'cropTypes'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );
  const { data: cropTypes, isLoading: isLoadingCropTypes } = useCollection<CropType>(cropTypesQuery);

  const form = useForm<z.infer<typeof cropTypeFormSchema>>({
    resolver: zodResolver(cropTypeFormSchema),
    defaultValues: {
      name: "",
      rate1: 10,
      rate6: 50,
      rate12: 90,
    },
  });

  function onSubmit(values: z.infer<typeof cropTypeFormSchema>) {
    if (!user) return;

    const cropTypesCol = collection(firestore, "cropTypes");
    
    const newCropType = {
      name: values.name,
      ownerId: user.uid,
      rates: {
        '1': values.rate1,
        '6': values.rate6,
        '12': values.rate12,
      },
    };

    addDocumentNonBlocking(cropTypesCol, newCropType);
    
    toast({
        title: "Crop Type Added",
        description: `"${values.name}" has been added to your crop types.`,
    });
    form.reset();
  }

  return (
    <>
      <PageHeader
        title="Manage Crop Types"
        description="Add or view your custom crop types and their storage rates."
      />
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-1">
            <Card>
                <CardHeader>
                <CardTitle>Add a New Crop Type</CardTitle>
                <CardDescription>Define a crop and its specific storage rates per bag.</CardDescription>
                </CardHeader>
                <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Crop Name</FormLabel>
                                <FormControl>
                                <Input placeholder="e.g., Maize, Soyabean" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <div className="space-y-2">
                            <FormLabel>Storage Rates (per bag)</FormLabel>
                            <div className="grid grid-cols-3 gap-2">
                                <FormField
                                control={form.control}
                                name="rate1"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel className="text-xs text-muted-foreground">1 Month</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                                <FormField
                                control={form.control}
                                name="rate6"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel className="text-xs text-muted-foreground">6 Months</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                                <FormField
                                control={form.control}
                                name="rate12"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel className="text-xs text-muted-foreground">12 Months</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                            </div>
                        </div>
                        <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
                            {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                            Add Crop Type
                        </Button>
                    </form>
                </Form>
                </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-2">
            <Card className="min-h-full">
                <CardHeader>
                    <CardTitle>Your Crop Types</CardTitle>
                    <CardDescription>A list of all your currently defined crop types and their rates.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingCropTypes ? (
                    <div className="flex justify-center items-center h-full pt-16">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                    ) : cropTypes && cropTypes.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                        {cropTypes.map(ct => (
                            <Card key={ct.id} className="bg-muted/30">
                                <CardHeader>
                                    <CardTitle className="text-lg">{ct.name}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-2 text-sm">
                                        <li className="flex justify-between items-baseline">
                                            <span className="text-muted-foreground">1 Month:</span>
                                            <span className="font-semibold">${ct.rates ? ct.rates['1'] : '0'}</span>
                                        </li>
                                        <li className="flex justify-between items-baseline">
                                            <span className="text-muted-foreground">6 Months:</span>
                                            <span className="font-semibold">${ct.rates ? ct.rates['6'] : '0'}</span>
                                        </li>
                                        <li className="flex justify-between items-baseline">
                                            <span className="text-muted-foreground">12 Months:</span>
                                            <span className="font-semibold">${ct.rates ? ct.rates['12'] : '0'}</span>
                                        </li>
                                    </ul>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    ) : (
                    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 p-12 text-center h-full">
                        <p className="text-sm text-muted-foreground">You haven't added any crop types yet.</p>
                    </div>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>
    </>
  );
}
