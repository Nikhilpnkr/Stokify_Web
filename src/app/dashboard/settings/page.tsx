
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useUser, useFirebase, useDoc, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { doc, collection, query, where, getDocs, writeBatch } from "firebase/firestore";
import { updateProfile, deleteUser } from "firebase/auth";
import type { UserProfile } from "@/lib/data";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";


const profileFormSchema = z.object({
  displayName: z.string().min(2, "Display name must be at least 2 characters."),
  email: z.string().email(),
  mobileNumber: z.string().optional(),
});

export default function SettingsPage() {
  const { auth, firestore, user } = useFirebase();
  const { toast } = useToast();
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [isDeleteDataOpen, setIsDeleteDataOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const userProfileRef = useMemoFirebase(() => 
    user ? doc(firestore, 'users', user.uid) : null
  , [firestore, user]);

  const { data: userProfile, isLoading: isLoadingProfile } = useDoc<UserProfile>(userProfileRef);

  const form = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: "",
      email: "",
      mobileNumber: "",
    },
  });

  useEffect(() => {
    if (userProfile) {
      form.reset({
        displayName: userProfile.displayName || "",
        email: userProfile.email || "",
        mobileNumber: userProfile.mobileNumber || "",
      });
    } else if (user) {
        form.reset({
            displayName: user.displayName || "",
            email: user.email || "",
            mobileNumber: userProfile?.mobileNumber || "",
        })
    }
  }, [userProfile, user, form]);

  async function onSubmit(values: z.infer<typeof profileFormSchema>) {
    if (!user || !userProfileRef) return;

    try {
      if (auth.currentUser && values.displayName !== auth.currentUser.displayName) {
        await updateProfile(auth.currentUser, { displayName: values.displayName });
      }

      const updatedData: Partial<UserProfile> = {
        displayName: values.displayName,
        mobileNumber: values.mobileNumber || '',
      };

      updateDocumentNonBlocking(userProfileRef, updatedData);

      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error updating profile",
        description: error.message,
      });
    }
  }

  async function handleDeleteAccount() {
    if (!user || !userProfileRef) return;
    setIsProcessing(true);

    try {
      deleteDocumentNonBlocking(userProfileRef);
      await deleteUser(user);
      toast({
        title: "Account Deleted",
        description: "Your account has been successfully deleted.",
      });
      redirect('/login');

    } catch (error: any) {
      console.error("Error deleting account:", error);
      toast({
        variant: "destructive",
        title: "Error Deleting Account",
        description: error.message || "An unexpected error occurred.",
      });
    } finally {
        setIsProcessing(false);
    }
  }

  async function handleDeleteAllData() {
    if (!user || !firestore) return;
    setIsProcessing(true);
    
    try {
      const batch = writeBatch(firestore);
      
      // Query and delete crop batches
      const batchesQuery = query(collection(firestore, "cropBatches"), where("ownerId", "==", user.uid));
      const batchesSnapshot = await getDocs(batchesQuery);
      batchesSnapshot.forEach(doc => batch.delete(doc.ref));

      // Query and delete outflows
      const outflowsQuery = query(collection(firestore, "outflows"), where("ownerId", "==", user.uid));
      const outflowsSnapshot = await getDocs(outflowsQuery);
      outflowsSnapshot.forEach(doc => batch.delete(doc.ref));

      await batch.commit();

      toast({
        title: "Data Deleted",
        description: "All transactional data has been successfully deleted.",
      });

    } catch (error: any) {
       console.error("Error deleting all data:", error);
      toast({
        variant: "destructive",
        title: "Error Deleting Data",
        description: error.message || "An unexpected error occurred while deleting data.",
      });
    } finally {
        setIsProcessing(false);
        setIsDeleteDataOpen(false);
    }
  }
  
  const isLoading = isLoadingProfile || form.formState.isSubmitting;

  return (
    <>
      <PageHeader
        title="Settings"
        description="View and manage your account details."
      />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Update your personal details here. Email address cannot be changed.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && !userProfile ? (
              <div className="flex items-center justify-center h-48">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 max-w-md">
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Your display name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="Your email" {...field} readOnly disabled />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mobileNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Your mobile number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormItem>
                    <FormLabel>Account Role</FormLabel>
                    <div>
                        <Badge variant={userProfile?.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                            {userProfile?.role || 'user'}
                        </Badge>
                    </div>
                </FormItem>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </form>
            </Form>
            )}
          </CardContent>
        </Card>

        <Card className="border-destructive">
            <CardHeader>
                <CardTitle>Danger Zone</CardTitle>
                <CardDescription>
                These actions are permanent and cannot be undone.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                 <div>
                    <h4 className="font-medium text-sm">Delete All Transactional Data</h4>
                    <p className="text-xs text-muted-foreground mb-2">Permanently deletes all crop batches and outflow records.</p>
                    <Button
                        variant="destructive"
                        onClick={() => setIsDeleteDataOpen(true)}
                        disabled={isProcessing}
                        >
                        {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Delete All Data
                    </Button>
                </div>
                 <div>
                    <h4 className="font-medium text-sm">Delete Account</h4>
                    <p className="text-xs text-muted-foreground mb-2">Permanently deletes your account and all associated data.</p>
                    <Button
                        variant="destructive"
                        onClick={() => setIsDeleteAccountOpen(true)}
                        disabled={isProcessing}
                        >
                        {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Delete Account
                    </Button>
                </div>
            </CardContent>
        </Card>
      </div>

      <AlertDialog open={isDeleteAccountOpen} onOpenChange={setIsDeleteAccountOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action is permanent. This will permanently delete your account and all associated data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAccount} disabled={isProcessing} className="bg-destructive hover:bg-destructive/90">
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteDataOpen} onOpenChange={setIsDeleteDataOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action is permanent. This will permanently delete all crop batch and transaction records. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAllData} disabled={isProcessing} className="bg-destructive hover:bg-destructive/90">
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete All Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
