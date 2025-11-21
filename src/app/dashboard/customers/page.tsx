
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Users, Loader2, Phone, User as UserIcon, PlusCircle, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCollection, useFirebase, useUser, useMemoFirebase, useDoc } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import type { Customer, Outflow, UserProfile } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { AddCustomerDialog } from "@/components/add-customer-dialog";
import { Input } from "@/components/ui/input";

function EmptyState({ onAdd, isSearching }: { onAdd: () => void, isSearching: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 p-12 text-center h-full">
      <Users className="mx-auto h-12 w-12 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-semibold text-foreground">{isSearching ? "No Customers Match Your Search" : "No Customers Found"}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{isSearching ? "Try a different search term." : "Get started by adding your first customer."}</p>
      {!isSearching && (
        <Button onClick={onAdd} className="mt-6">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Customer
        </Button>
      )}
    </div>
  )
}

export default function CustomersPage() {
  const { firestore } = useFirebase();
  const { user } = useUser();
  const router = useRouter();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const userProfileRef = useMemoFirebase(() => 
    user ? doc(firestore, 'users', user.uid) : null
  , [firestore, user]);
  const { data: userProfile, isLoading: isLoadingProfile } = useDoc<UserProfile>(userProfileRef);

  const customersQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const baseQuery = collection(firestore, 'customers');
    if (userProfile.role === 'admin' || userProfile.role === 'manager') {
      return baseQuery;
    }
    return query(baseQuery, where('ownerId', '==', user.uid));
  }, [firestore, user, userProfile]);

  const outflowsQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const baseQuery = collection(firestore, 'outflows');
    if (userProfile.role === 'admin' || userProfile.role === 'manager') {
        return baseQuery;
    }
    return query(baseQuery, where('ownerId', '==', user.uid));
  }, [firestore, user, userProfile]);


  const { data: allCustomers, isLoading: isLoadingCustomers } = useCollection<Customer>(customersQuery);
  const { data: outflows, isLoading: isLoadingOutflows } = useCollection<Outflow>(outflowsQuery);

  const customers = useMemo(() => {
    if (!allCustomers) return [];
    return allCustomers.filter(customer => 
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.mobileNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allCustomers, searchTerm]);

  const customerBalances = useMemo(() => {
    if (!outflows) return new Map<string, number>();

    const balances = new Map<string, number>();
    outflows.forEach(outflow => {
        if (outflow.balanceDue > 0) {
            const currentBalance = balances.get(outflow.customerId) || 0;
            balances.set(outflow.customerId, currentBalance + outflow.balanceDue);
        }
    });
    return balances;
  }, [outflows]);


  const handleCardClick = (customerId: string) => {
    router.push(`/dashboard/customers/${customerId}`);
  };

  const isLoading = isLoadingCustomers || isLoadingOutflows || isLoadingProfile;

  return (
    <>
      <PageHeader
        title="Customers"
        description="View all customers and their stored batches. Balances are shown in red."
         action={
          <Button onClick={() => setIsAddDialogOpen(true)} disabled={!user}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Customer
          </Button>
        }
      />

      <div className="mb-6">
        <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Search by name or mobile..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>
      
      {isLoading ? (
         <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : customers && customers.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {customers.map((customer) => {
            const balance = customerBalances.get(customer.id);
            return (
                <Card 
                key={customer.id} 
                className="flex flex-col cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handleCardClick(customer.id)}
                >
                <CardHeader>
                    <div className="flex items-start justify-between">
                    <CardTitle className="text-lg font-medium">{customer.name}</CardTitle>
                    <UserIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col justify-end">
                    <div className="space-y-2 text-sm text-muted-foreground">
                    {customer.mobileNumber && (
                        <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span>{customer.mobileNumber}</span>
                        </div>
                    )}
                    {balance && balance > 0 && (
                        <div>
                            <Badge variant="destructive">
                                Balance: {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Rp
                            </Badge>
                        </div>
                    )}
                    </div>
                </CardContent>
                </Card>
            )
          })}
        </div>
      ) : (
        <EmptyState onAdd={() => setIsAddDialogOpen(true)} isSearching={!!searchTerm} />
      )}
      <AddCustomerDialog
        isOpen={isAddDialogOpen}
        setIsOpen={setIsAddDialogOpen}
        existingCustomers={allCustomers || []}
       />
    </>
  );
}
