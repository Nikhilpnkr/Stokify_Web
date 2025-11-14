"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCollection, useFirebase, useUser, useMemoFirebase, addDocumentNonBlocking } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import type { CropType } from "@/lib/data";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";


const cropTypeFormSchema = z.object({
  name: z.string().min(2, "Crop name must be at least 2 characters."),
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
        description="Add or view your custom crop types."
      />
      <Card>
        <CardHeader>
          <CardTitle>Add a New Crop Type</CardTitle>
          <CardDescription>Use the form below to add a new crop to your list.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-start gap-4 mb-6 max-w-lg">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="flex-grow">
                    <FormLabel className="sr-only">Crop Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Maize, Soyabean" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                Add Crop
              </Button>
            </form>
          </Form>
          <div className="border rounded-md p-4 min-h-[200px]">
            <h4 className="font-semibold mb-3 text-lg">Your Crop Types</h4>
            {isLoadingCropTypes ? (
              <div className="flex justify-center items-center h-full pt-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : cropTypes && cropTypes.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {cropTypes.map(ct => <Badge key={ct.id} variant="secondary" className="text-base px-4 py-1">{ct.name}</Badge>)}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center pt-16">You haven't added any crop types yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
