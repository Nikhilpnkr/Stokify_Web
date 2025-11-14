"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Leaf,
  Warehouse,
  BarChart,
  LayoutDashboard,
  Menu,
  LogIn,
  LogOut,
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
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth, useUser } from "@/firebase";
import {
  signInWithRedirect,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";

const navItems = [
  { href: "/dashboard", label: "Inventory", icon: LayoutDashboard },
  { href: "/dashboard/locations", label: "Locations", icon: Warehouse },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart },
];

function UserNav() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();

  const handleLogin = () => {
    if (auth) {
      const provider = new GoogleAuthProvider();
      signInWithRedirect(auth, provider);
    }
  };

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
      <Button variant="ghost" onClick={handleLogin}>
        <LogIn className="mr-2" />
        Sign In
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
              {user.displayName?.charAt(0) || user.email?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>Settings</DropdownMenuItem>
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
  const isMobile = useIsMobile();
  const { user } = useUser();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarHeader className="p-4">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Leaf className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-headline font-bold">CropSafe</h1>
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
            {user && (
              <div className="flex items-center gap-3 p-2">
                <Avatar>
                  {user.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || 'User avatar'}/>}
                  <AvatarFallback>
                    {user.displayName?.charAt(0) || "U"}
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
            {isMobile && <SidebarTrigger asChild><Button variant="ghost" size="icon"><Menu /></Button></SidebarTrigger>}
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
