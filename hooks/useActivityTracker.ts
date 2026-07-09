import { useEffect, useRef, useState } from 'react';
import { loginSessionService } from '../lib/firestore/loginSessionService';
import { Timestamp } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';

interface ActivityTrackerOptions {
  sessionId?: string | null;
  idleTimeoutMinutes?: number;
  heartbeatIntervalSeconds?: number;
  minSelfieIntervalMinutes?: number;
  maxSelfieIntervalMinutes?: number;
}

export function useActivityTracker({
  sessionId,
  idleTimeoutMinutes = 5,
  heartbeatIntervalSeconds = 60,
  minSelfieIntervalMinutes = 120, // 2 hours
  maxSelfieIntervalMinutes = 240, // 4 hours
}: ActivityTrackerOptions) {
  // Counters
  const mouseMovements = useRef(0);
  const keystrokes = useRef(0);
  const tabFocusChanges = useRef(0);
  
  // Timing
  const totalActiveMinutes = useRef(0);
  const totalIdleMinutes = useRef(0);
  
  // State tracking
  const lastActivityTime = useRef(Date.now());
  const isIdle = useRef(false);
  const idlePeriods = useRef<{ start: Timestamp; end: Timestamp | null }[]>([]);
  
  // Selfie Prompt
  const [showSelfiePrompt, setShowSelfiePrompt] = useState(false);
  const nextSelfieTime = useRef<number | null>(null);

  // Desktop Agent tracking
  const activeOsApp = useRef<{ title: string; ownerName: string } | null>(null);

  // Setup random selfie timer
  const scheduleNextSelfie = () => {
    const minMs = minSelfieIntervalMinutes * 60 * 1000;
    const maxMs = maxSelfieIntervalMinutes * 60 * 1000;
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1) + minMs);
    nextSelfieTime.current = Date.now() + delay;
  };

  useEffect(() => {
    if (!sessionId) return;
    scheduleNextSelfie();

    const checkSelfiePrompt = setInterval(() => {
      if (nextSelfieTime.current && Date.now() >= nextSelfieTime.current && !showSelfiePrompt) {
        setShowSelfiePrompt(true);
      }
    }, 60000);

    // If running in Desktop Agent, listen for active window changes
    if (typeof window !== 'undefined' && (window as any).desktopAgent) {
      (window as any).desktopAgent.onActiveAppChanged((appInfo: any) => {
        activeOsApp.current = appInfo;
      });
    }

    return () => clearInterval(checkSelfiePrompt);
  }, [sessionId]);

  // Activity listeners
  useEffect(() => {
    if (!sessionId || showSelfiePrompt) return;

    const handleActivity = () => {
      lastActivityTime.current = Date.now();
      if (isIdle.current) {
        // Came back from idle
        isIdle.current = false;
        const currentPeriods = [...idlePeriods.current];
        if (currentPeriods.length > 0) {
          currentPeriods[currentPeriods.length - 1].end = Timestamp.now();
          idlePeriods.current = currentPeriods;
        }
      }
    };

    let mouseMoveTimeout: NodeJS.Timeout | null = null;
    const handleMouseMove = () => {
      if (!mouseMoveTimeout) {
        mouseMovements.current += 1;
        handleActivity();
        mouseMoveTimeout = setTimeout(() => {
          mouseMoveTimeout = null;
        }, 500); // Throttle mouse count to 2 per second max
      }
    };

    const handleKeyDown = () => {
      keystrokes.current += 1;
      handleActivity();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabFocusChanges.current += 1;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (mouseMoveTimeout) clearTimeout(mouseMoveTimeout);
    };
  }, [sessionId, showSelfiePrompt]);

  // Idle check & Heartbeat loop
  useEffect(() => {
    if (!sessionId) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = (now - lastActivityTime.current) / 1000 / 60; // in minutes

      if (timeSinceLastActivity >= idleTimeoutMinutes && !isIdle.current) {
        // Just became idle
        isIdle.current = true;
        idlePeriods.current.push({ start: Timestamp.now(), end: null });
      }

      // Increment timers
      if (isIdle.current) {
        totalIdleMinutes.current += (heartbeatIntervalSeconds / 60);
      } else {
        totalActiveMinutes.current += (heartbeatIntervalSeconds / 60);
      }

      // Calculate score (simple version: penalizes high idle time and too many focus changes)
      const totalMinutes = totalActiveMinutes.current + totalIdleMinutes.current;
      const idleRatio = totalMinutes > 0 ? totalIdleMinutes.current / totalMinutes : 0;
      let score = 100 - (idleRatio * 50); // Max 50 point penalty for idle
      score -= (tabFocusChanges.current * 0.5); // 0.5 point penalty per tab switch
      score = Math.max(0, Math.min(100, Math.round(score)));

      // Send Heartbeat
      loginSessionService.heartbeat(sessionId, {
        status: isIdle.current ? 'idle' : 'active',
        mouseMovements: mouseMovements.current,
        keystrokes: keystrokes.current,
        tabFocusChanges: tabFocusChanges.current,
        totalActiveMinutes: Math.round(totalActiveMinutes.current),
        totalIdleMinutes: Math.round(totalIdleMinutes.current),
        activityScore: score,
        idlePeriods: idlePeriods.current,
        activeOsApp: activeOsApp.current
      }).catch(console.error);

    }, heartbeatIntervalSeconds * 1000);

    return () => clearInterval(interval);
  }, [sessionId, idleTimeoutMinutes, heartbeatIntervalSeconds]);

  // Handle beforeunload to end session
  useEffect(() => {
    if (!sessionId) return;

    const handleBeforeUnload = () => {
      loginSessionService.endSession(sessionId, {
        mouseMovements: mouseMovements.current,
        keystrokes: keystrokes.current,
        tabFocusChanges: tabFocusChanges.current,
        totalActiveMinutes: Math.round(totalActiveMinutes.current),
        totalIdleMinutes: Math.round(totalIdleMinutes.current)
      }).catch(console.error);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sessionId]);

  const submitSelfie = async (base64Image: string) => {
    if (!sessionId) return;
    try {
      const storage = getStorage();
      const fileRef = ref(storage, `selfies/${sessionId}_${Date.now()}.jpg`);
      await uploadString(fileRef, base64Image, 'data_url');
      const url = await getDownloadURL(fileRef);
      await loginSessionService.submitSelfie(sessionId, url);
      
      setShowSelfiePrompt(false);
      scheduleNextSelfie();
    } catch (e) {
      console.error("Selfie upload failed:", e);
      throw e;
    }
  };

  return {
    showSelfiePrompt,
    submitSelfie
  };
}
