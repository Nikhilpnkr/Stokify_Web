
import getConfig from 'next/config';

const { publicRuntimeConfig } = getConfig() || {};

// This function safely retrieves the config, ensuring it works on server and client
function getFirebaseConfig() {
    if (publicRuntimeConfig && publicRuntimeConfig.firebaseConfig) {
        return publicRuntimeConfig.firebaseConfig;
    }
    // Fallback for when not running in a Next.js context (e.g. certain scripts)
    // Or for client-side where NEXT_PUBLIC_ vars are available
    return {
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    };
}


export const firebaseConfig = getFirebaseConfig();
