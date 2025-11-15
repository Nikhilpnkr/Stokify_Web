
"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CropType, StorageLocation, StorageArea, Customer, CropBatch, Outflow } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { useFirebase, useUser, setDocumentNonBlocking, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, getDocs, doc } from "firebase/firestore";
import { PlusCircle, Trash2, Calendar as CalendarIcon } from "lucide-react";
import { generateInvoicePdf } from "@/lib/pdf";
import type { InvoiceData } from "@/components/invoice";
import { Combobox } from "@/components/ui/combobox";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const areaAllocationSchema = z.object({
    areaId: z.string().min(1, "Area is required."),
    quantity: z.coerce.number().min(1, "Min 1."),
});

type AddBatchDialogProps = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  locations: StorageLocation[];
  cropTypes: CropType[];
  customers: Customer[];
  allBatches: CropBatch[];
};

export function AddBatchDialog({ isOpen, setIsOpen, locations, cropTypes, customers, allBatches }: AddBatchDialogProps) {
  const { toast } = useToast();
  const { firestore, user } = useFirebase();
  const [areasWithUsage, setAreasWithUsage] = useState<any[]>([]);
  const [isNewCustomer, setIsNewCustomer] = useState(true);

  const formSchema = z.object({
    customerId: z.string(), // Can be an existing ID or a placeholder for a new customer
    customerName: z.string().min(2, "Customer name is required."),
    customerMobile: z.string().min(10, "A valid mobile number is required.").refine(val => !customers.some(c => c.mobileNumber === val && c.id !== form.getValues('customerId')), { message: "This mobile number is already taken."}),
    cropTypeId: z.string().min(1, "Please select a crop type."),
    locationId: z.string().min(1, "Please select a storage location."),
    dateAdded: z.date(),
    areaAllocations: z.array(areaAllocationSchema).min(1, "At least one area allocation is required."),
    labourChargePerBag: z.coerce.number().optional(),
  }).refine((data) => {
      const areaIds = data.areaAllocations.map(alloc => alloc.areaId);
      return new Set(areaIds).size === areaIds.length;
    }, {
        message: "Each storage area can only be used once per batch.",
        path: ["areaAllocations"],
    })
    .refine((data) => {
        for(const alloc of data.areaAllocations) {
            const area = areasWithUsage.find(a => a.id === alloc.areaId);
            if (area && alloc.quantity > area.available) {
                return false;
            }
        }
        return true;
    }, {
        message: "Quantity exceeds available capacity for an area.",
        path: ["areaAllocations"],
    });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerId: 'new_customer',
      customerName: "",
      customerMobile: "",
      cropTypeId: "",
      locationId: "",
      dateAdded: new Date(),
      areaAllocations: [{ areaId: "", quantity: 0 }],
      labourChargePerBag: 0,
    },
  });
  
  const selectedLocationId = useWatch({
    control: form.control,
    name: "locationId"
  });

  const selectedCustomerId = useWatch({
      control: form.control,
      name: "customerId",
  });

  useEffect(() => {
    if (selectedCustomerId && selectedCustomerId !== 'new_customer') {
        const customer = customers.find(c => c.id === selectedCustomerId);
        if (customer) {
            form.setValue('customerName', customer.name);
            form.setValue('customerMobile', customer.mobileNumber);
            setIsNewCustomer(false);
        }
    } else {
        form.setValue('customerName', '');
        form.setValue('customerMobile', '');
        setIsNewCustomer(true);
    }
  }, [selectedCustomerId, customers, form]);

  const customerOptions = useMemo(() => {
    const options = customers.map(c => ({ value: c.id, label: `${c.name} - ${c.mobileNumber}` }));
    options.unshift({ value: 'new_customer', label: 'Add a new customer' });
    return options;
  }, [customers]);

  const areasQuery = useMemoFirebase(() =>
    selectedLocationId ? collection(firestore, "storageLocations", selectedLocationId, "areas") : null,
    [firestore, selectedLocationId]
  );
  const { data: areas, isLoading: isLoadingAreas } = useCollection<StorageArea>(areasQuery);
  
  useEffect(() => {
    if (!areas) {
      setAreasWithUsage([]);
      return;
    }
    const calculatedUsage = areas
      .map(area => {
        const used = allBatches
          .flatMap(b => b.areaAllocations || [])
          .filter(alloc => alloc.areaId === area.id)
          .reduce((acc, alloc) => acc + alloc.quantity, 0);
        const available = area.capacity - used;
        return { ...area, used, available };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    setAreasWithUsage(calculatedUsage);
  }, [areas, allBatches]);
  
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "areaAllocations",
  });

  const watchedAllocations = useWatch({ control: form.control, name: 'areaAllocations' });
  const watchedLabourCharge = useWatch({ control: form.control, name: 'labourChargePerBag' });
  const totalQuantity = watchedAllocations.reduce((sum, alloc) => sum + (Number(alloc.quantity) || 0), 0);
  const totalLabourCharge = (totalQuantity * (watchedLabourCharge || 0));

  useEffect(() => {
    if(isOpen) {
        form.reset({
            customerId: 'new_customer',
            customerName: "",
            customerMobile: "",
            cropTypeId: "",
            locationId: "",
            dateAdded: new Date(),
            areaAllocations: [{ areaId: "", quantity: 0 }],
            labourChargePerBag: 0,
        });
    }
  }, [isOpen, form]);


  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user || !firestore) {
      toast({ variant: "destructive", title: "Authentication Error", description: "You must be signed in." });
      return;
    }

    const selectedCropType = cropTypes.find(ct => ct.id === values.cropTypeId);
    const selectedLocation = locations.find(l => l.id === values.locationId);
    
    if (!selectedCropType || !selectedLocation) {
        toast({ variant: "destructive", title: "Error", description: "Selected crop type or location not found." });
        return;
    }

    let finalCustomer: Customer;

    if (isNewCustomer) {
        const customerQuery = query(collection(firestore, 'customers'), where('mobileNumber', '==', values.customerMobile), where('ownerId', '==', user.uid));
        const querySnapshot = await getDocs(customerQuery);
        
        if (!querySnapshot.empty) {
            form.setError("customerMobile", { message: "A customer with this mobile number already exists."});
            return;
        }

        const newCustomerRef = doc(collection(firestore, "customers"));
        finalCustomer = {
            id: newCustomerRef.id,
            name: values.customerName,
            mobileNumber: values.customerMobile,
            ownerId: user.uid
        };
        setDocumentNonBlocking(newCustomerRef, finalCustomer, { merge: false });
    } else {
        const existingCustomer = customers.find(c => c.id === values.customerId);
        if (!existingCustomer) {
             toast({ variant: "destructive", title: "Error", description: "Could not find selected customer." });
             return;
        }
        finalCustomer = existingCustomer;
    }


    const cropBatchesCol = collection(firestore, "cropBatches");
    const newDocRef = doc(cropBatchesCol);

    const newBatch = {
      id: newDocRef.id,
      cropType: selectedCropType.name,
      areaAllocations: values.areaAllocations,
      storageLocationId: values.locationId,
      dateAdded: values.dateAdded.toISOString(),
      ownerId: user.uid,
      customerId: finalCustomer.id,
      customerName: finalCustomer.name,
      labourCharge: totalLabourCharge,
    };
    
    setDocumentNonBlocking(newDocRef, newBatch, { merge: false });

    toast({
      title: "Success! Batch Added.",
      description: `New batch for ${finalCustomer.name} has been added.`,
    });
    setIsOpen(false);
    form.reset();
  }

  const handleLocationChange = (locationId: string) => {
    form.setValue("locationId", locationId);
    form.setValue('areaAllocations', [{ areaId: "", quantity: 0 }]);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-lg w-full m-4">
        <DialogHeader>
          <DialogTitle>Add New Crop Batch</DialogTitle>
          <DialogDescription>
            Fill in the details below to add a new batch to your inventory.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
             <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Customer</FormLabel>
                        <FormControl>
                            <Combobox
                                options={customerOptions}
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="Select an existing customer..."
                                searchPlaceholder="Search customers..."
                                emptyPlaceholder="No customer found. Type to add a new one."
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            {isNewCustomer && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>New Customer Name</FormLabel>
                        <FormControl>
                            <Input placeholder="Enter full name" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="customerMobile"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>New Customer Mobile</FormLabel>
                        <FormControl>
                            <Input placeholder="Enter mobile" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
            )}
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="cropTypeId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Crop Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a crop type" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {cropTypes.map((ct) => (
                            <SelectItem key={ct.id} value={ct.id}>
                            {ct.name}
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
                 <FormField
                    control={form.control}
                    name="dateAdded"
                    render={({ field }) => (
                        <FormItem className="flex flex-col pt-2">
                        <FormLabel>Date Added</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                variant={"outline"}
                                className={cn(
                                    "pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                )}
                                >
                                {field.value ? (
                                    format(field.value, "PPP")
                                ) : (
                                    <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                date > new Date() || date < new Date("1900-01-01")
                                }
                                initialFocus
                            />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <FormField
              control={form.control}
              name="locationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Storage Location</FormLabel>
                  <Select onValueChange={handleLocationChange} value={field.value} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a location" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4 rounded-md border p-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-medium">Area Allocations</h3>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => append({ areaId: "", quantity: 0 })}
                        disabled={!selectedLocationId}
                    >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Area
                    </Button>
                </div>
                 {fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-[1fr_100px_auto] gap-2 items-start">
                        <FormField
                            control={form.control}
                            name={`areaAllocations.${index}.areaId`}
                            render={({ field }) => (
                                <FormItem>
                                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value} disabled={!selectedLocationId || isLoadingAreas}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder={isLoadingAreas ? "Loading..." : "Select area"} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {areasWithUsage?.map(area => (
                                                <SelectItem key={area.id} value={area.id} disabled={area.available <= 0 || watchedAllocations.some((a, i) => i !== index && a.areaId === area.id)}>
                                                    {area.name} (Avail: {area.available.toLocaleString()}/{area.capacity.toLocaleString()})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`areaAllocations.${index}.quantity`}
                            render={({ field }) => (
                                <FormItem>
                                     <FormControl>
                                        <Input
                                            type="number"
                                            placeholder="Qty"
                                            onWheel={(e) => (e.target as HTMLElement).blur()}
                                            {...field}
                                            value={field.value ?? ''}
                                        />
                                     </FormControl>
                                      <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                 ))}
                 <FormMessage>{form.formState.errors.areaAllocations?.root?.message || form.formState.errors.areaAllocations?.message}</FormMessage>
            </div>
            
            <FormField
              control={form.control}
              name="labourChargePerBag"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Labour Charge per Bag (Optional)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 5" {...field} value={field.value ?? ''} onWheel={(e) => (e.target as HTMLElement).blur()} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2 font-semibold p-2 rounded-md bg-muted">
                <div className="flex justify-between">
                    <span>Total Quantity:</span>
                    <span>{totalQuantity.toLocaleString()} bags</span>
                </div>
                <div className="flex justify-between">
                    <span>Total Labour Charge:</span>
                    <span>₹{totalLabourCharge.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
            </div>


            <DialogFooter>
              <Button type="submit">Add Batch</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
