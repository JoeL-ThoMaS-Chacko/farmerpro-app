import { initializeApp } from "firebase/app";
import { GoogleAuthProvider, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:
    "3333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333s",
  authDomain: "33333333333333333333333333333333333333333333333333333333333m",
  projectId: "3333333333333333333333333333333333333333333333e333",
  storageBucket: "333333333333333333333333333333333333333333p",
  messagingSenderId: "3333333333333333333333333333333333333333333",
  appId: "333333333333333333333333333333333333333333333333333334",
  measurementId: "333333333333333333333333333333333333333333333333333333NJ0",
};

const app = initializeApp(firebaseConfig);

// initializeAuth without persistence - avoids ALL window/browser errors.
// Login state is managed manually via AsyncStorage in _layout.tsx anyway
// so Firebase's own session persistence is not needed.
export const auth = initializeAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
