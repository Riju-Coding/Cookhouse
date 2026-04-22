import { useEffect, useState, useRef, useCallback } from "react"
import { ref, update, onValue, get, remove } from "firebase/database"
import { rtdb } from "@/lib/firebase"

/**
 * useLiveMenuEdits
 * 
 * Synchronizes real-time draft changes directly over the Firebase Realtime Database.
 * This is used so other users can see live updates to the grid without incurring
 * expensive Firestore document writes on every cell edit.
 */
export function useLiveMenuEdits(menuId: string | undefined, onRemoteChange?: (newData: Record<string, any>) => void) {
  const [draftChanges, setDraftChanges] = useState<Record<string, any>>({});
  const lastLocalUpdateRef = useRef<number>(0);
  const onRemoteChangeRef = useRef(onRemoteChange);

  // Keep ref updated without triggering re-renders
  useEffect(() => {
    onRemoteChangeRef.current = onRemoteChange;
  }, [onRemoteChange]);
  
  useEffect(() => {
    if (!menuId) return;

    const draftsRef = ref(rtdb, `menu-drafts/${menuId}`);

    const unsubscribe = onValue(draftsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setDraftChanges(data);
        
        // Notify the UI to merge these changes into `menuData`
        // We only notify if it's been a little while since OUR last broadcast,
        // otherwise we might overwrite our own optimistic state.
        if (Date.now() - lastLocalUpdateRef.current > 500) {
          onRemoteChangeRef.current?.(data);
        }
      }
    });

    return () => unsubscribe();
  }, [menuId]);

  // Push an update to RTDB
  const broadcastEdit = useCallback(async (cellId: string, cellData: any) => {
    if (!menuId) return;
    
    lastLocalUpdateRef.current = Date.now();
    const draftsRef = ref(rtdb, `menu-drafts/${menuId}`);
    
    // Partially update the RTDB node with just this cell's changes
    try {
      await update(draftsRef, {
        [cellId]: cellData
      });
    } catch (e) {
      console.error("Failed to broadcast edit:", e);
    }
  }, [menuId]);

  // Clean up all drafts upon successful save
  const clearDrafts = useCallback(async () => {
    if (!menuId) return;
    try {
      const draftsRef = ref(rtdb, `menu-drafts/${menuId}`);
      await remove(draftsRef);
      setDraftChanges({});
    } catch (e) {
      console.error("Failed to clear drafts:", e);
    }
  }, [menuId]);

  return {
    draftChanges,
    broadcastEdit,
    clearDrafts
  };
}
