
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Trash2, Edit, X } from "lucide-react";
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
  insurance: z.coerce.number().min(0, "Insurance must be a positive number.").optional(),
});

export default function CropTypesManagerPage() {
  const { firestore, user } = useFirebase();
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [cropTypeToDelete, setCropTypeToDelete] = useState<CropType | null>(null);
  const [editingCropTypeId, setEditingCropTypeId] = useState<string | null>(null);
  
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
      insurance: 0,
    },
  });

  const isEditing = !!editingCropTypeId;

  function handleEdit(cropType: CropType) {
    setEditingCropTypeId(cropType.id);
    form.reset({
        name: cropType.name,
        rate1: cropType.rates['1'],
        rate6: cropType.rates['6'],
        rate12: cropType.rates['12'],
        insurance: cropType.insurance || 0,
    });
  }

  function cancelEdit() {
    setEditingCropTypeId(null);
    form.reset({
      name: "",
      rate1: STORAGE_RATES[1],
      rate6: STORAGE_RATES[6],
      rate12: STORAGE_RATES[12],
      insurance: 0,
    });
  }


  async function onSubmit(values: z.infer<typeof cropTypeFormSchema>) {
    if (!user || !firestore) return;

    const cropData = {
      name: values.name,
      ownerId: user.uid,
      rates: {
        '1': values.rate1,
        '6': values.rate6,
        '12': values.rate12,
      },
      insurance: values.insurance || 0,
    };

    if (isEditing && editingCropTypeId) {
        const docRef = doc(firestore, "cropTypes", editingCropTypeId);
        updateDocumentNonBlocking(docRef, cropData);
        toast({
            title: "Crop Type Updated",
            description: `"${values.name}" has been updated.`,
        });
    } else {
        const newDocRef = doc(collection(firestore, "cropTypes"));
        const newCropType = { id: newDocRef.id, ...cropData };
        addDocumentNonBlocking(newDocRef, newCropType);
        toast({
            title: "Crop Type Added",
            description: `"${values.name}" has been added to your crop types.`,
        });
    }

    cancelEdit();
  }

  function handleDeleteConfirmation(cropType: CropType) {
    setCropTypeToDelete(cropType);
    setIsDeleteDialogOpen(true);
  }

  async function executeDelete() {
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
        description="Add, edit, or view your custom crop types and their storage rates."
      />
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-2">
            <Card>
                <CardHeader>
                <CardTitle>{isEditing ? "Edit Crop Type" : "Add a New Crop Type"}</CardTitle>
                <CardDescription>{isEditing ? `Editing "${form.getValues('name')}"` : "Define a crop and its storage costs."}</CardDescription>
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
                        <div>
                            <p className="text-sm font-medium mb-2">Storage Rates (per bag)</p>
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
                        </div>

                        <FormField
                            control={form.control}
                            name="insurance"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Insurance (per bag)</FormLabel>
                                <FormControl>
                                <Input type="number" placeholder="e.g., 2" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />

                        <div className="flex gap-2">
                             {isEditing && (
                                <Button type="button" variant="outline" onClick={cancelEdit} className="w-full">
                                    <X className="mr-2 h-4 w-4" />
                                    Cancel
                                </Button>
                             )}
                            <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
                                {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isEditing ? <Edit className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)}
                                {isEditing ? "Save Changes" : "Add Crop Type"}
                            </Button>
                        </div>
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
                                        <div className="flex items-center">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(ct)}>
                                                <Edit className="h-4 w-4" />
                                                <span className="sr-only">Edit {ct.name}</span>
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteConfirmation(ct)}>
                                                <Trash2 className="h-4 w-4" />
                                                <span className="sr-only">Delete {ct.name}</span>
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <ul className="text-sm space-y-1">
                                        <li className="flex justify-between items-baseline">
                                            <span className="text-muted-foreground">1 Month:</span>
                                            <span className="font-semibold">{ct.rates ? ct.rates['1'] : '0'} Rps</span>
                                        </li>
                                        <li className="flex justify-between items-baseline">
                                            <span className="text-muted-foreground">6 Months:</span>
                                            <span className="font-semibold">{ct.rates ? ct.rates['6'] : '0'} Rps</span>
                                        </li>
                                        <li className="flex justify-between items-baseline">
                                            <span className="text-muted-foreground">1 Year:</span>
                                            <span className="font-semibold">{ct.rates ? ct.rates['12'] : '0'} Rps</span>
                                        </li>
                                        <li className="flex justify-between items-baseline mt-2 pt-2 border-t">
                                            <span className="text-muted-foreground">Insurance:</span>
                                            <span className="font-semibold">{ct.insurance || '0'} Rps</span>
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
