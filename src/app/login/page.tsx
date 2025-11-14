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

  useEffect(() => {
    if (!isUserLoading && user) {
      redirect('/dashboard');
    }
  }, [user, isUserLoading]);

  const handleGoogleSignIn = () => {
    if (auth) {
      const provider = new GoogleAuthProvider();
      // This function initiates the redirect to Google's sign-in page.
      // After the user signs in, they will be redirected back to the app,
      // where the onAuthStateChanged listener will detect the new session.
      signInWithRedirect(auth, provider);
    }
  };

  // While firebase is checking for an existing session, show a loader.
  // This also handles the redirect period after returning from Google.
  if (isUserLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </main>
    )
  }
  
  // If the user is not loading and is not logged in, show the login UI.
  if (!user) {
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

  // If we reach here, it means user is loaded and exists, but useEffect hasn't redirected yet.
  // Can show a loader or null.
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </main>
  );
}
