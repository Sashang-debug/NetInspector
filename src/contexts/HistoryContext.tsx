import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  writeBatch,
  getDocs
} from "firebase/firestore";

export type HistoryEntry = {
  id: string;
  target: string;
  tool: string;
  timestamp: number;
  status: "Success" | "Failed";
  responseTime?: number;
  error?: string;
  uid?: string;
};

type HistoryContextType = {
  history: HistoryEntry[];
  addHistoryEntry: (entry: Omit<HistoryEntry, "id" | "uid">) => Promise<void>;
  removeHistoryEntry: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  reloadHistory: () => void;
};

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

export function HistoryProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const { user } = useAuth();
  
  useEffect(() => {
    console.log("[Audit] HistoryProvider mounted/updated for user:", user?.uid || "none");
  }, [user]);

  const reloadHistory = useCallback(() => {
    // With onSnapshot, this is handled automatically. 
    // We keep the signature to avoid breaking existing components.
  }, []);

  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }

    try {
      const historyRef = collection(db, "history");
      // Remove orderBy("timestamp", "desc") to avoid requiring a composite index in Firestore
      const q = query(
        historyRef,
        where("uid", "==", user.uid)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const historyData: HistoryEntry[] = [];
        snapshot.forEach((docSnap) => {
          historyData.push({ id: docSnap.id, ...docSnap.data() } as HistoryEntry);
        });
        
        // Sort locally by timestamp descending
        historyData.sort((a, b) => b.timestamp - a.timestamp);
        
        setHistory(historyData);
      }, (error) => {
        console.error("Error subscribing to history (non-fatal):", error);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error("Error setting up history snapshot (non-fatal):", err);
      return () => {};
    }
  }, [user]);

  const addHistoryEntry = async (entry: Omit<HistoryEntry, "id" | "uid">) => {
    if (!user) return;
    try {
      const historyRef = collection(db, "history");
      await addDoc(historyRef, {
        ...entry,
        uid: user.uid,
      });
    } catch (error) {
      console.error("Error adding history entry:", error);
    }
  };

  const removeHistoryEntry = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "history", id));
    } catch (error) {
      console.error("Error removing history entry:", error);
    }
  };

  const clearHistory = async () => {
    if (!user) return;
    try {
      const historyRef = collection(db, "history");
      const q = query(historyRef, where("uid", "==", user.uid));
      const querySnapshot = await getDocs(q);
      
      // Firestore batch deletes
      const batch = writeBatch(db);
      querySnapshot.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
      
      // The onSnapshot listener will automatically update the UI
    } catch (error) {
      console.error("Error clearing history:", error);
      throw error; // Let the UI handle the error (e.g. show toast)
    }
  };

  return (
    <HistoryContext.Provider
      value={{ history, addHistoryEntry, removeHistoryEntry, clearHistory, reloadHistory }}
    >
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistory() {
  const context = useContext(HistoryContext);
  if (context === undefined) {
    throw new Error("useHistory must be used within a HistoryProvider");
  }
  return context;
}
