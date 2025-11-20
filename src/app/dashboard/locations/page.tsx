
"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PlusCircle, Warehouse, Loader2, Phone, MapPin, Edit, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AddLocationDialog } from "@/components/add-location-dialog";
import { EditLocationDialog } from "@/components/edit-location-dialog";
import { useCollection, useFirebase, useUser, useMemoFirebase, useDoc } from "@/firebase";
import { collection, query, where, getDocs, doc } from "firebase/firestore";
import type { StorageLocation, Inflow, StorageArea, UserProfile } from "@/lib/data";
import { Input } from "@/components/ui/input";

function EmptyState({ onAdd, isSearching }: { onAdd: () => void, isSearching: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 p-12 text-center h-full">
      <Warehouse className="mx-auto h-12 w-12 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-semibold text-foreground">{isSearching ? "No Locations Match Your Search" : "No Locations Found"}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{isSearching ? "Try a different search term." : "Get started by adding a new storage location."}</p>
      {!isSearching && (
        <Button onClick={onAdd} className="mt-6">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Location
        </Button>
      )}
    </div>
  )
}

export default function LocationsPage() {
  const { firestore } = useFirebase();
  const { user } = useUser();
  const router = useRouter();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<StorageLocation | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [allAreas, setAllAreas] = useState<StorageArea[]>([]);
  const [isLoadingAreas, setIsLoadingAreas] = useState(true);

  const userProfileRef = useMemoFirebase(() => 
    user ? doc(firestore, 'users', user.uid) : null
  , [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  const locationsQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const baseQuery = collection(firestore, 'storageLocations');
    if (userProfile.role === 'admin' || userProfile.role === 'manager') {
      return baseQuery;
    }
    return query(baseQuery, where('ownerId', '==', user.uid));
  }, [firestore, user, userProfile]);

  const inflowsQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const baseQuery = collection(firestore, 'inflows');
    if (userProfile.role === 'admin' || userProfile.role === 'manager') {
        return baseQuery;
    }
    return query(baseQuery, where('ownerId', '==', user.uid));
  }, [firestore, user, userProfile]);

  const { data: allLocations, isLoading: isLoadingLocations } = useCollection<StorageLocation>(locationsQuery);
  const { data: inflows, isLoading: isLoadingInflows } = useCollection<Inflow>(inflowsQuery);

  useEffect(() => {
    async function fetchAllAreas() {
      if (!allLocations || allLocations.length === 0 || !firestore) {
        setAllAreas([]);
        setIsLoadingAreas(false);
        return;
      };
      setIsLoadingAreas(true);
      const areas: StorageArea[] = [];
      for (const location of allLocations) {
        const areasColRef = collection(firestore, 'storageLocations', location.id, 'areas');
        const areasSnapshot = await getDocs(areasColRef);
        areasSnapshot.forEach(doc => {
          areas.push({ id: doc.id, ...doc.data() } as StorageArea);
        });
      }
      setAllAreas(areas);
      setIsLoadingAreas(false);
    }
    if(allLocations) fetchAllAreas();
  }, [allLocations, firestore]);

  const locations = useMemo(() => {
    if (!allLocations) return [];
    return allLocations.filter(loc => 
      loc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loc.address.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allLocations, searchTerm]);

  const locationsWithUsage = useMemo(() => {
    if (!locations || !inflows || isLoadingAreas) return [];
    return locations.map(location => {
      const locationAreas = allAreas.filter(area => area.storageLocationId === location.id);
      const totalCapacity = locationAreas.reduce((acc, area) => acc + area.capacity, 0);

      const used = inflows
        .filter(b => b.storageLocationId === location.id)
        .reduce((acc, b) => acc + (b.areaAllocations?.reduce((sum, alloc) => sum + alloc.quantity, 0) || 0), 0);
      
      const percentage = totalCapacity > 0 ? (used / totalCapacity) * 100 : 0;
      return { ...location, used, percentage, capacity: totalCapacity };
    });
  }, [locations, inflows, allAreas, isLoadingAreas]);

  const handleEditClick = (e: React.MouseEvent, location: StorageLocation) => {
    e.stopPropagation();
    setSelectedLocation(location);
    setIsEditDialogOpen(true);
  }
  
  const handleCardClick = (locationId: string) => {
    router.push(`/dashboard/locations/${locationId}`);
  };


  const isLoading = isLoadingLocations || isLoadingInflows || isLoadingAreas;

  return (
    <>
      <PageHeader
        title="Storage Locations"
        description="Manage your warehouses, silos, and other storage areas."
        action={
          <Button onClick={() => setIsAddDialogOpen(true)} disabled={!user}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Location
          </Button>
        }
      />
      
      <div className="mb-6">
        <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Search by name or address..."
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
      ) : locationsWithUsage.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {locationsWithUsage.map((location) => (
            <Card 
              key={location.id} 
              className="flex flex-col cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleCardClick(location.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg font-medium">{location.name}</CardTitle>
                  <Warehouse className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="pt-2 space-y-1 text-sm text-muted-foreground">
                  {location.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{location.address}</span>
                    </div>
                  )}
                  {location.mobileNumber && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>{location.mobileNumber}</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col justify-end">
                <div>
                    <div className="text-2xl font-bold">{location.used.toLocaleString()} / {location.capacity.toLocaleString()} bags</div>
                    <p className="text-xs text-muted-foreground">
                    {Math.round(location.percentage)}% capacity used
                    </p>
                    <Progress value={location.percentage} className="mt-4 h-2" />
                </div>
              </CardContent>
              <CardFooter>
                 <Button variant="outline" size="sm" className="w-full" onClick={(e) => handleEditClick(e, location)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Location
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState onAdd={() => setIsAddDialogOpen(true)} isSearching={!!searchTerm} />
      )}

      <AddLocationDialog
        isOpen={isAddDialogOpen}
        setIsOpen={setIsAddDialogOpen}
      />
      {selectedLocation && (
        <EditLocationDialog
          isOpen={isEditDialogOpen}
          setIsOpen={setIsEditDialogOpen}
          location={selectedLocation}
        />
      )}
    </>
  );
}
