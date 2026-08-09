import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import type { User } from "firebase/auth";
import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import { auth, db } from "../firebase";
import { doc, setDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { toast } from "sonner";

export type UserProfile = {
  uid: string;
  name?: string;
  email?: string;
  photoURL?: string;
  settings?: {
    apiKeys?: {
      shodan?: string;
      virusTotal?: string;
    };
  };
};

type AuthContextType = {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeSnapshot: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      console.log("[Audit] Auth state changed, user:", currentUser?.uid);
      setUser(currentUser);
      
      if (currentUser) {
        console.log("[Audit] Starting background Firestore sync for user...");
        const userRef = doc(db, "users", currentUser.uid);
        
        // Run Firestore write in background. Do NOT await it here to prevent blocking.
        setDoc(userRef, {
          uid: currentUser.uid,
          name: currentUser.displayName,
          email: currentUser.email,
          photoURL: currentUser.photoURL,
          lastLogin: serverTimestamp(),
          // Only set createdAt if the document is new (use merge: true)
          createdAt: currentUser.metadata.creationTime 
            ? new Date(currentUser.metadata.creationTime)
            : serverTimestamp()
        }, { merge: true })
        .then(() => console.log("[Audit] Background user sync complete"))
        .catch((error) => {
          console.error("Error saving user to Firestore (non-fatal):", error);
        });

        // Listen for live profile updates (including settings/API keys)
        unsubscribeSnapshot = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          }
        }, (error) => {
          console.error("Error subscribing to user profile (non-fatal):", error);
        });
      } else {
        setUserProfile(null);
      }
      
      setLoading(false); // Update loading state immediately so UI renders
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  const login = async () => {
    try {
      console.log("[Audit] Starting Google Sign In...");
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      console.log("[Audit] Google Sign In popup completed");
    } catch (error: any) {
      console.error("Authentication popup failed:", error);
      toast.error(error.message || "Authentication failed.");
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error: any) {
      toast.error("Failed to sign out.");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}