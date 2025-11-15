
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useFirebase, useUser, setDocumentNonBlocking } from "@/firebase";
import { doc, collection } from "firebase/firestore";
import type { Customer } from "@/lib/data";

const formSchema = z.object({
  name: z.string().min(2, "Customer name must be at least 2 characters."),
  mobileNumber: z.string().min(10, "Please enter a valid 10-digit mobile number.").max(10, "Please enter a valid 10-digit mobile number."),
});

type AddCustomerDialogProps = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  existingCustomers: Customer[];
};

export function AddCustomerDialog({ isOpen, setIsOpen, existingCustomers }: AddCustomerDialogProps) {
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const { user } = useUser();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            mobileNumber: "",
        },
    });

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "You must be signed in to add a customer."
      });
      return;
    }

    // Check for duplicates
    if (existingCustomers.some(c => c.mobileNumber === values.mobileNumber)) {
        form.setError("mobileNumber", {
            type: "manual",
            message: "A customer with this mobile number already exists.",
        });
        return;
    }

    const customersCol = collection(firestore, "customers");
    const newDocRef = doc(customersCol);
    
    const newCustomer = {
      id: newDocRef.id,
      name: values.name,
      mobileNumber: values.mobileNumber,
      ownerId: user.uid,
    };

    setDocumentNonBlocking(newDocRef, newCustomer, { merge: false });
    
    toast({
        title: "Success!",
        description: `Customer "${values.name}" has been added.`,
    });
    setIsOpen(false);
    form.reset();
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Customer</DialogTitle>
          <DialogDescription>
            Add a new customer to your records.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., John Doe" {...field} />
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
                    <Input placeholder="Enter 10-digit mobile number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Add Customer
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

