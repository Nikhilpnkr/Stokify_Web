
"use client";

import Link from "next/link";
import { usePathname, redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  Leaf,
  Warehouse,
  BarChart,
  LayoutDashboard,
  LogIn,
  LogOut,
  Loader2,
  User as UserIcon,
  Users,
  Wheat,
  Settings,
  Receipt,
  CreditCard,
  Archive,
  History,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth, useUser, useDoc, useMemoFirebase, useFirebase } from "@/firebase";
import { signOut } from "firebase/auth";
import type { UserProfile } from "@/lib/data";
import { doc } from "firebase/firestore";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/inventory", label: "Inventory", icon: Archive },
  { href: "/dashboard/locations", label: "Locations", icon: Warehouse },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart },
  { href: "/dashboard/crops", label: "Crops", icon: Wheat },
  { href: "/dashboard/customers", label: "Customers", icon: Users },
  { href: "/dashboard/transactions", label: "Transactions", icon: Receipt },
  { href: "/dashboard/payments", label: "Payments", icon: CreditCard },
  { href: "/dashboard/audit-log", label: "Audit Log", icon: History },
];

const bottomNavItems = [
    { href: "/dashboard/settings", label: "Settings", icon: Settings },
]

function UserNav() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();

  const handleLogout = () => {
    if (auth) {
      signOut(auth);
    }
  };

  if (isUserLoading) {
    return <Button variant="ghost" size="icon" className="rounded-full" disabled />;
  }

  if (!user) {
    return (
      <Button asChild variant="ghost">
        <Link href="/login">
          <LogIn className="mr-2" />
          Sign In
        </Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Avatar>
            {user.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || 'User avatar'} />}
            <AvatarFallback>
              {user.displayName?.charAt(0) || user.email?.charAt(0)?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings">
            <UserIcon className="mr-2" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>Support</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, isUserLoading, firestore } = useFirebase();

  const userProfileRef = useMemoFirebase(() => 
    user ? doc(firestore, 'users', user.uid) : null
  , [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  // While checking for user auth, show a full-screen loader.
  if (isUserLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // After loading, if no user is found, redirect to the login page.
  if (!user) {
    return redirect('/login');
  }

  // If user is found, render the dashboard.
  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarRail />
          <SidebarHeader className="p-4">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Leaf className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-headline font-bold">Stokify</h1>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      item.href === "/dashboard"
                        ? pathname === item.href
                        : pathname.startsWith(item.href)
                    }
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
                {bottomNavItems.map((item) => (
                    <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                        asChild
                        isActive={pathname.startsWith(item.href)}
                    >
                        <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                        </Link>
                    </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
            {user && (
              <div className="flex items-center gap-3 p-2">
                <Avatar>
                  {user.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || 'User avatar'}/>}
                  <AvatarFallback>
                    {user.email?.charAt(0)?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col overflow-hidden">
                  <span className="font-semibold text-sm truncate">{user.displayName || 'Anonymous'}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {user.email || 'No email'}
                  </span>
                </div>
              </div>
            )}
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="flex h-14 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 lg:px-6 sticky top-0 z-30">
            <div className="flex-1">
              {/* Maybe add breadcrumbs here later */}
            </div>
            <UserNav />
          </header>
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
