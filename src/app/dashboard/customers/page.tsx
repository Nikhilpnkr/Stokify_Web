
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Users, Loader2, Phone, User as UserIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useCollection, useFirebase, useUser, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import type { Customer } from "@/lib/data";

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 p-12 text-center h-full">
      <Users className="mx-auto h-12 w-12 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-semibold text-foreground">No Customers Found</h3>
      <p className="mt-2 text-sm text-muted-foreground">Customers are added automatically when you create a new crop batch.</p>
    </div>
  )
}

export default function CustomersPage() {
  const { firestore } = useFirebase();
  const { user } = useUser();
  const router = useRouter();

  const customersQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, 'customers'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]
  );

  const { data: customers, isLoading: isLoadingCustomers } = useCollection<Customer>(customersQuery);

  const handleCardClick = (customerId: string) => {
    router.push(`/dashboard/customers/${customerId}`);
  };

  if (isLoadingCustomers) {
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
        description="View all customers and their stored batches."
      />
      
      {customers && customers.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {customers.map((customer) => (
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
                <div className="space-y-1 text-sm text-muted-foreground">
                  {customer.mobileNumber && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>{customer.mobileNumber}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </>
  );
}
