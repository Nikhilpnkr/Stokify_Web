
"use client";

import { useEffect } from "react";
import { redirect } from 'next/navigation';
import { Leaf, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth, useUser } from "@/firebase";
import { signInWithRedirect, GoogleAuthProvider } from "firebase/auth";
import { FcGoogle } from "react-icons/fc";

export default function LoginPage() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();

  // If user is logged in, redirect to dashboard.
  useEffect(() => {
    if (user) {
      redirect('/dashboard');
    }
  }, [user]);

  const handleGoogleSignIn = () => {
    if (auth) {
      const provider = new GoogleAuthProvider();
      // This will redirect the user to Google's sign-in page.
      // After sign-in, onAuthStateChanged in the provider will handle the user session.
      signInWithRedirect(auth, provider);
    }
  };
  
  // This state handles the redirect from Google. After the redirect, isUserLoading will be true
  // while Firebase confirms the session. We show a loader during this period.
  if (isUserLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Authenticating...</p>
      </main>
    )
  }
  
  // If not loading and no user, show the full login page.
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="flex items-center gap-3 mb-8">
        <Leaf className="h-12 w-12 text-primary" />
        <h1 className="text-5xl font-headline font-bold">CropSafe</h1>
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Get Started</CardTitle>
          <CardDescription>
            Sign in or create an account to access your dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
            >
              <FcGoogle className="mr-2 h-5 w-5" />
              Continue with Google
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  CropSafe Demo
                </span>
              </div>
            </div>
            <p className="px-8 text-center text-sm text-muted-foreground">
              Using Google OAuth is the only sign-in method for this demo.
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
