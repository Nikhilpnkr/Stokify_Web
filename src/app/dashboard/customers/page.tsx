
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Users, Loader2, Phone, User as UserIcon, PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useCollection, useFirebase, useUser, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import type { Customer, Outflow } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { AddCustomerDialog } from "@/components/add-customer-dialog";

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 p-12 text-center h-full">
      <Users className="mx-auto h-12 w-12 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-semibold text-foreground">No Customers Found</h3>
      <p className="mt-2 text-sm text-muted-foreground">Get started by adding your first customer.</p>
       <Button onClick={onAdd} className="mt-6">
        <PlusCircle className="mr-2 h-4 w-4" />
        Add New Customer
      </Button>
    </div>
  )
}

export default function CustomersPage() {
  const { firestore } = useFirebase();
  const { user } = useUser();
  const router = useRouter();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);


  const customersQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, 'customers'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );
  const outflowsQuery = useMemoFirebase(() =>
    user ? query(collection(firestore, 'outflows'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );

  const { data: customers, isLoading: isLoadingCustomers } = useCollection<Customer>(customersQuery);
  const { data: outflows, isLoading: isLoadingOutflows } = useCollection<Outflow>(outflowsQuery);

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

  const isLoading = isLoadingCustomers || isLoadingOutflows;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
      
      {customers && customers.length > 0 ? (
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
                                Balance: ₹{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
        <EmptyState onAdd={() => setIsAddDialogOpen(true)} />
      )}
      <AddCustomerDialog
        isOpen={isAddDialogOpen}
        setIsOpen={setIsAddDialogOpen}
        existingCustomers={customers || []}
       />
    </>
  );
}
