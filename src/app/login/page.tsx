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
    if (user) {
      redirect('/dashboard');
    }
  }, [user]);

  const handleGoogleSignIn = () => {
    if (auth) {
      const provider = new GoogleAuthProvider();
      signInWithRedirect(auth, provider);
    }
  };

  if (isUserLoading || user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="flex items-center gap-3 mb-8">
        <Leaf className="h-12 w-12 text-primary" />
        <h1 className="text-5xl font-headline font-bold">CropSafe</h1>
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>
            Sign in to access your crop inventory dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={isUserLoading}
            >
              <FcGoogle className="mr-2 h-5 w-5" />
              Sign in with Google
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>
            <p className="px-8 text-center text-sm text-muted-foreground">
              This is a demo application. More sign-in options would be here.
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
