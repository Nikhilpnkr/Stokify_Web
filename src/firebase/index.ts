'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
// This function ensures that Firebase is initialized only once.
function getFirebaseServices() {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  return {
    app,
    auth: getAuth(app),
    firestore: getFirestore(app),
  };
}

// A stable, top-level call to get the services.
const firebaseServices = getFirebaseServices();

// Export a function that returns the already-initialized services.
export function initializeFirebase() {
  return firebaseServices;
}


export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './errors';
export * from './error-emitter';
