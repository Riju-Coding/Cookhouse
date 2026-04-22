import { useEffect, useState, useRef } from "react"
import { ref, set, onValue, onDisconnect, remove } from "firebase/database"
import { rtdb } from "@/lib/firebase"

export interface EditorPresence {
  userId: string;
  name: string;
  activeCell: string | null;
  timestamp: number;
}

export function useMenuPresence(
  menuId: string, 
  userId: string | undefined, 
  userName: string | undefined
) {
  const [activeEditors, setActiveEditors] = useState<Record<string, EditorPresence>>({});
  const presenceRef = useRef<any>(null);
  
  useEffect(() => {
    if (!menuId || !userId || !userName) return;

    // The unique path for this user in this specific menu session
    const userSessionPath = `menu-sessions/${menuId}/users/${userId}`;
    presenceRef.current = ref(rtdb, userSessionPath);

    const initialPresence: EditorPresence = {
      userId,
      name: userName,
      activeCell: null,
      timestamp: Date.now()
    };

    // 1. Set presence to active when joining
    set(presenceRef.current, initialPresence);

    // 2. Setup automatic removal on disconnect
    onDisconnect(presenceRef.current).remove();

    // 3. Listen for all users currently in this menu session
    const allSessionsPath = `menu-sessions/${menuId}/users`;
    const sessionsRef = ref(rtdb, allSessionsPath);
    
    const unsubscribe = onValue(sessionsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Remove ourselves from the active editors map to make rendering easier
        const others = { ...data };
        delete others[userId];
        setActiveEditors(others);
      } else {
        setActiveEditors({});
      }
    });

    return () => {
      // 4. Clean up gracefully if the component unmounts
      unsubscribe();
      if (presenceRef.current) {
        remove(presenceRef.current);
      }
    };
  }, [menuId, userId, userName]);

  const updateActiveCell = (cellId: string | null) => {
    if (!presenceRef.current || !userId || !userName) return;
    
    set(presenceRef.current, {
      userId,
      name: userName,
      activeCell: cellId,
      timestamp: Date.now()
    });
  };

  return {
    activeEditors,
    updateActiveCell
  };
}
