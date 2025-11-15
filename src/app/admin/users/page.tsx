
"use client";

import { useMemo, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Mail, Search, Trash2 } from "lucide-react";
import { useCollection, useFirebase, useMemoFirebase, updateDocumentNonBlocking, useDoc } from "@/firebase";
import { collection, query, where, doc, getDocs, writeBatch } from "firebase/firestore";
import type { UserProfile, UserRole } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { redirect } from "next/navigation";


export default function UserManagementPage() {
  const { firestore, user } = useFirebase();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const currentUserProfileRef = useMemoFirebase(() => 
    user ? doc(firestore, 'users', user.uid) : null,
    [firestore, user]
  );
  const { data: currentUserProfile, isLoading: isLoadingCurrentUser } = useDoc<UserProfile>(currentUserProfileRef);

  // Query all users. Security rules will enforce that only admins can do this.
  const usersQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'users')) : null,
    [firestore]
  );
  const { data: allUsers, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);

  const users = useMemo(() => {
    if (!allUsers) return [];
    // Exclude the current admin from the list
    const otherUsers = allUsers.filter(profile => profile.uid !== user?.uid);
    
    if (!searchTerm) return otherUsers;

    return otherUsers.filter(profile => 
        (profile.displayName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (profile.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );
  }, [allUsers, searchTerm, user]);


  useEffect(() => {
    if (currentUserProfile && currentUserProfile.role === 'admin') {
      toast({
        title: `Welcome, ${currentUserProfile.displayName}!`,
        description: `You are logged in as an administrator.`,
      });
    }
  }, [currentUserProfile, toast]);


  const handleRoleChange = (userId: string, newRole: UserRole) => {
    if (!firestore) return;
    if (currentUserProfile?.role !== 'admin') {
        toast({
            variant: "destructive",
            title: "Permission Denied",
            description: "Only admins can change user roles.",
        });
        return;
    }

    const userRef = doc(firestore, "users", userId);
    updateDocumentNonBlocking(userRef, { role: newRole });
    toast({
      title: "Role Updated",
      description: `User role has been successfully changed to ${newRole}.`,
    });
  };

  async function handleDeleteAllData() {
    if (!firestore || !allUsers) return;
    setIsProcessing(true);

    try {
        const batch = writeBatch(firestore);
        
        // Delete all data associated with each user
        for (const userToDelete of allUsers) {
            const collectionsToDelete = ["cropBatches", "outflows", "payments", "customers", "cropTypes"];
            for (const collectionName of collectionsToDelete) {
                const q = query(collection(firestore, collectionName), where("ownerId", "==", userToDelete.uid));
                const snapshot = await getDocs(q);
                snapshot.forEach(doc => batch.delete(doc.ref));
            }

            const locationsQuery = query(collection(firestore, "storageLocations"), where("ownerId", "==", userToDelete.uid));
            const locationsSnapshot = await getDocs(locationsQuery);
            for (const locationDoc of locationsSnapshot.docs) {
                const areasQuery = collection(firestore, "storageLocations", locationDoc.id, "areas");
                const areasSnapshot = await getDocs(areasQuery);
                areasSnapshot.forEach(areaDoc => batch.delete(areaDoc.ref));
                batch.delete(locationDoc.ref);
            }
            
            // Delete the user profile itself
            const userProfileRef = doc(firestore, 'users', userToDelete.uid);
            batch.delete(userProfileRef);
        }

        await batch.commit();
        
        toast({
            title: "All Data Purged",
            description: "All users and their associated application data have been deleted. You will be logged out.",
            duration: 5000,
        });
        
        // Redirect to login after a delay to allow toast to be seen
        setTimeout(() => {
            redirect('/login');
        }, 3000);

    } catch (error: any) {
       console.error("Error deleting all data:", error);
       toast({
            variant: "destructive",
            title: "Error Purging Data",
            description: error.message || "An unexpected error occurred.",
        });
    } finally {
        setIsProcessing(false);
        setIsDeleteAllOpen(false);
    }
  }

  const isLoading = isLoadingUsers || isLoadingCurrentUser;

  const roles: UserRole[] = ['admin', 'manager', 'assistant', 'user'];

  return (
    <>
      <PageHeader
        title="User Management"
        description="View and manage user roles. Only admins can modify roles."
      />
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <CardTitle>All Users</CardTitle>
                <CardDescription>
                    {users?.length || 0} other users found in the system.
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by name or email..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            </div>
          ) : users && users.length > 0 ? (
            <>
              {/* Mobile View */}
              <div className="grid gap-4 md:hidden">
                {users.map((profile) => (
                  <Card key={profile.uid} className="bg-muted/30">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <CardTitle className="text-base">{profile.displayName}</CardTitle>
                          <div className="flex items-center text-sm text-muted-foreground gap-2"><Mail className="h-4 w-4"/> {profile.email}</div>
                        </div>
                         <Badge variant={profile.role === 'admin' ? 'default' : 'secondary'} className="capitalize">{profile.role}</Badge>
                      </div>
                    </CardHeader>
                    <CardFooter>
                       <Select
                          defaultValue={profile.role}
                          onValueChange={(value: UserRole) => handleRoleChange(profile.uid, value)}
                          disabled={profile.uid === user?.uid || currentUserProfile?.role !== 'admin'}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map(role => (
                              <SelectItem key={role} value={role} className="capitalize">
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                    </CardFooter>
                  </Card>
                ))}
              </div>
              
              {/* Desktop View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Display Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Current Role</TableHead>
                      <TableHead className="w-[180px]">Change Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((profile) => (
                      <TableRow key={profile.uid}>
                        <TableCell className="font-medium">{profile.displayName}</TableCell>
                        <TableCell>{profile.email}</TableCell>
                        <TableCell>
                            <Badge variant={profile.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                                {profile.role}
                            </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            defaultValue={profile.role}
                            onValueChange={(value: UserRole) => handleRoleChange(profile.uid, value)}
                            disabled={profile.uid === user?.uid || currentUserProfile?.role !== 'admin'}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            <SelectContent>
                              {roles.map(role => (
                                <SelectItem key={role} value={role} className="capitalize">
                                  {role}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="h-48 flex justify-center items-center text-muted-foreground">
              {searchTerm ? "No users match your search." : "No other users found."}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive mt-6">
        <CardHeader>
            <CardTitle>Danger Zone</CardTitle>
            <CardDescription>
            This action is permanent and will delete all users and all associated data.
            </CardDescription>
        </CardHeader>
        <CardContent>
             <Button
                variant="destructive"
                onClick={() => setIsDeleteAllOpen(true)}
                disabled={isProcessing}
                >
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Delete All Users & Data
            </Button>
        </CardContent>
      </Card>
      
      <AlertDialog open={isDeleteAllOpen} onOpenChange={setIsDeleteAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete ALL users and ALL associated data from the database. It is intended for a complete application reset.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAllData} disabled={isProcessing} className="bg-destructive hover:bg-destructive/90">
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

    