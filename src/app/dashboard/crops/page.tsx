
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useCollection, useFirebase, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import type { CropType } from "@/lib/data";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { STORAGE_RATES } from "@/lib/data";

const cropTypeFormSchema = z.object({
  name: z.string().min(2, "Crop name must be at least 2 characters."),
  rate1: z.coerce.number().min(0, "Rate must be a positive number."),
  rate6: z.coerce.number().min(0, "Rate must be a positive number."),
  rate12: z.coerce.number().min(0, "Rate must be a positive number."),
});

export default function CropTypesManagerPage() {
  const { firestore, user } = useFirebase();
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [cropTypeToDelete, setCropTypeToDelete] = useState<CropType | null>(null);
  
  const cropTypesQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, 'cropTypes'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );
  const { data: cropTypes, isLoading: isLoadingCropTypes } = useCollection<CropType>(cropTypesQuery);

  const form = useForm<z.infer<typeof cropTypeFormSchema>>({
    resolver: zodResolver(cropTypeFormSchema),
    defaultValues: {
      name: "",
      rate1: STORAGE_RATES[1],
      rate6: STORAGE_RATES[6],
      rate12: STORAGE_RATES[12],
    },
  });

  function onSubmit(values: z.infer<typeof cropTypeFormSchema>) {
    if (!user) return;

    const cropTypesCol = collection(firestore, "cropTypes");
    const newDocRef = doc(cropTypesCol);
    
    const newCropType = {
      id: newDocRef.id,
      name: values.name,
      ownerId: user.uid,
      rates: {
        '1': values.rate1,
        '6': values.rate6,
        '12': values.rate12,
      }
    };

    addDocumentNonBlocking(cropTypesCol, newCropType);
    
    toast({
        title: "Crop Type Added",
        description: `"${values.name}" has been added to your crop types.`,
    });
    form.reset();
  }

  function handleDeleteConfirmation(cropType: CropType) {
    setCropTypeToDelete(cropType);
    setIsDeleteDialogOpen(true);
  }

  function executeDelete() {
    if (!cropTypeToDelete || !firestore) return;

    const cropTypeRef = doc(firestore, "cropTypes", cropTypeToDelete.id);
    deleteDocumentNonBlocking(cropTypeRef);

    toast({
      title: "Crop Type Deleted",
      description: `"${cropTypeToDelete.name}" has been removed.`,
    });
    
    setIsDeleteDialogOpen(false);
    setCropTypeToDelete(null);
  }


  return (
    <>
      <PageHeader
        title="Manage Crop Types"
        description="Add or view your custom crop types and their storage rates."
      />
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-2">
            <Card>
                <CardHeader>
                <CardTitle>Add a New Crop Type</CardTitle>
                <CardDescription>Define a crop and its storage rates.</CardDescription>
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
                        <div className="grid grid-cols-3 gap-4">
                            <FormField
                                control={form.control}
                                name="rate1"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>1 Month</FormLabel>
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
                                    <FormLabel>6 Months</FormLabel>
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
                                    <FormLabel>1 Year</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
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
        <div className="lg:col-span-3">
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
                                    <div className="flex flex-row items-start justify-between pb-2">
                                        <CardTitle className="text-lg">{ct.name}</CardTitle>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteConfirmation(ct)}>
                                            <Trash2 className="h-4 w-4" />
                                            <span className="sr-only">Delete {ct.name}</span>
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm font-medium mb-2">Storage Rates (per bag)</p>
                                    <ul className="text-sm space-y-1">
                                        <li className="flex justify-between items-baseline">
                                            <span className="text-muted-foreground">1 Month:</span>
                                            <span className="font-semibold">₹{ct.rates ? ct.rates['1'] : '0'}</span>
                                        </li>
                                        <li className="flex justify-between items-baseline">
                                            <span className="text-muted-foreground">6 Months:</span>
                                            <span className="font-semibold">₹{ct.rates ? ct.rates['6'] : '0'}</span>
                                        </li>
                                        <li className="flex justify-between items-baseline">
                                            <span className="text-muted-foreground">1 Year:</span>
                                            <span className="font-semibold">₹{ct.rates ? ct.rates['12'] : '0'}</span>
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
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the crop type "{cropTypeToDelete?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className="bg-destructive hover:bg-destructive/90">
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
