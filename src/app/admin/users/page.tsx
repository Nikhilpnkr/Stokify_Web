
"use client";

import { useMemo, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { useCollection, useFirebase, useMemoFirebase, updateDocumentNonBlocking, useDoc } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
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

export default function UserManagementPage() {
  const { firestore, user } = useFirebase();
  const { toast } = useToast();

  const currentUserProfileRef = useMemoFirebase(() => 
    user ? doc(firestore, 'users', user.uid) : null,
    [firestore, user]
  );
  const { data: currentUserProfile, isLoading: isLoadingCurrentUser } = useDoc<UserProfile>(currentUserProfileRef);

  const usersQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, 'users'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );
  const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);

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
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            {users?.length || 0} users found that you manage.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              ) : users && users.length > 0 ? (
                users.map((profile) => (
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
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
