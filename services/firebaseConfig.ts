import { initializeApp } from "firebase/app";
import { 
  initializeFirestore,
  enableMultiTabIndexedDbPersistence, 
  enableIndexedDbPersistence 
} from "firebase/firestore";

// Updated Firebase configuration provided by the user
const firebaseConfig = {
  apiKey: "AIzaSyB-8exODAYXe5xoN33JPegSbJtuEpbFuYI",
  authDomain: "factorysystem-c2402.firebaseapp.com",
  projectId: "factorysystem-c2402",
  storageBucket: "factorysystem-c2402.firebasestorage.app",
  messagingSenderId: "589461124653",
  appId: "1:589461124653:web:1c6b8fa519c81096aaaaa4",
  measurementId: "G-QQW4B40PVH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

/**
 * Initialize Firestore with long-polling enabled.
 * This fixes "Could not reach Cloud Firestore backend" errors by using
 * HTTP long-polling instead of WebSockets, which can be blocked or unstable.
 */
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

// Enable Offline Persistence
const enablePersistence = async () => {
  try {
    await enableMultiTabIndexedDbPersistence(db);
    console.log("Multi-tab persistence enabled");
  } catch (err: any) {
    if (err.code == 'failed-precondition') {
        console.warn("Multiple tabs open, persistence can only be enabled in one tab at a time.");
    } else if (err.code == 'unimplemented') {
        try {
            await enableIndexedDbPersistence(db);
            console.log("Single-tab persistence enabled");
        } catch (innerErr) {
            console.warn("Persistence could not be enabled", innerErr);
        }
    } else {
        console.warn("Persistence error:", err);
    }
  }
};

enablePersistence();