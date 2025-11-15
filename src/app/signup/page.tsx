
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, useUser, useFirebase, setDocumentNonBlocking } from "@/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

export default function SignUpPage() {
  const auth = useAuth();
  const { firestore } = useFirebase();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // If user is logged in, redirect to dashboard.
  useEffect(() => {
    if (!isUserLoading && user) {
      redirect('/dashboard');
    }
  }, [user, isUserLoading]);

  const handleSignUp = async () => {
    if (!auth || !firestore) return;
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update the user's profile with display name
      await updateProfile(userCredential.user, {
        displayName: displayName
      });

      // Create a user profile document in Firestore
      const userRef = doc(firestore, "users", userCredential.user.uid);
      const userProfile = {
        uid: userCredential.user.uid,
        displayName: displayName,
        email: email,
        mobileNumber: mobileNumber,
        role: 'user', // Assign default role
        ownerId: userCredential.user.uid, // The user owns their own profile
      };
      setDocumentNonBlocking(userRef, userProfile, { merge: false });

      // Redirect will be handled by the useEffect
    } catch (error: any) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Sign up failed",
        description: error.message || "An unknown error occurred.",
      });
      setIsLoading(false);
    }
  };
  
  if (isUserLoading || user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading...</p>
      </main>
    )
  }
  
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="flex items-center gap-3 mb-8">
        <Leaf className="h-12 w-12 text-primary" />
        <h1 className="text-5xl font-headline font-bold">Stokify</h1>
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Create an Account</CardTitle>
          <CardDescription>
            Enter your details below to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="John Doe"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mobileNumber">Mobile Number</Label>
              <Input
                id="mobileNumber"
                type="tel"
                placeholder="+1234567890"
                required
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button onClick={handleSignUp} disabled={isLoading} className="w-full">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </Button>
          </div>
          <div className="mt-4 text-center text-sm">
            Already have an account?{" "}
            <Link href="/login" className="underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
