
"use server";

import { addDocumentNonBlocking } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { initializeFirebase } from "@/firebase";

type ActionType = 
    | "CREATE_LOCATION" | "DELETE_LOCATION" | "UPDATE_LOCATION"
    | "CREATE_AREA" | "DELETE_AREA" | "BULK_CREATE_AREAS"
    | "CREATE_CROP_TYPE" | "UPDATE_CROP_TYPE" | "DELETE_CROP_TYPE"
    | "CREATE_CUSTOMER" | "DELETE_CUSTOMER"
    | "CREATE_BATCH" | "CREATE_OUTFLOW" | "CREATE_PAYMENT";

export async function logAction(
    action: ActionType, 
    { entityType, entityId, details }: { entityType: string; entityId: string, details: string }
) {
    // This is a server action, so we need to initialize Firebase services here.
    // This is safe to call multiple times.
    const { firestore, auth } = initializeFirebase();
    const user = auth.currentUser;

    if (!user) {
        console.error("Audit log failed: User not authenticated.");
        return;
    }

    const logRef = doc(collection(firestore, "auditLogs"));
    const logEntry = {
        id: logRef.id,
        ownerId: user.uid,
        date: new Date().toISOString(),
        action,
        entityType,
        entityId,
        details,
    };
    
    addDocumentNonBlocking(logRef, logEntry);
}
