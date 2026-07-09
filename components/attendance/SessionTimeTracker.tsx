"use client";

import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { doc, onSnapshot, getDoc, collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Clock, Briefcase, AlertTriangle, ShieldAlert, Coffee } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { loginSessionService } from "@/lib/firestore/loginSessionService";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

export function SessionTimeTracker() {
  const { loginSessionId, loginSessionError, userProfile } = useAuth();
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [expectedShiftSeconds, setExpectedShiftSeconds] = useState<number | null>(null);
  
  const [activeBreak, setActiveBreak] = useState<any>(null);
  const [breakElapsedSeconds, setBreakElapsedSeconds] = useState(0);

  // Map JS Date.getDay() (0-6) to Work Days array format
  const getDayName = (date: Date) => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[date.getDay()];
  };

  useEffect(() => {
    if (!userProfile) return;

    const computeDynamicShiftDuration = async () => {
      const todayName = getDayName(new Date());
      let totalSecondsForToday = 0;
      let hasShiftToday = false;

      // Ensure assignedShifts exists
      if (!userProfile.assignedShifts || userProfile.assignedShifts.length === 0) {
        setExpectedShiftSeconds(0);
        return;
      }

      // Check each assigned shift
      for (const assignment of userProfile.assignedShifts) {
        // If it has workDays array, check if today is included. (If it doesn't have workDays, assume it's active everyday for legacy support)
        if (assignment.workDays && assignment.workDays.length > 0 && !assignment.workDays.includes(todayName)) {
          continue;
        }

        hasShiftToday = true;

        if (assignment.cafeteriaId === 'global') {
          // Fetch global shift
          try {
            const globalDoc = await getDoc(doc(db, "global_shifts", assignment.shiftId));
            if (globalDoc.exists()) {
              const shiftDef = globalDoc.data();
              if (shiftDef && shiftDef.startTime && shiftDef.endTime) {
                const [startH, startM] = shiftDef.startTime.split(':').map(Number);
                const [endH, endM] = shiftDef.endTime.split(':').map(Number);
                
                let durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
                if (durationMinutes < 0) durationMinutes += 24 * 60; // Crosses midnight
                
                totalSecondsForToday += (durationMinutes * 60);
              }
            }
          } catch (err) {
            console.error("Error fetching global shift config", err);
          }
        } else {
          // Fetch the shift definition from the cafeteria
          try {
            const cafeDoc = await getDoc(doc(db, "cafetarias", assignment.cafeteriaId));
            if (cafeDoc.exists()) {
              const cafeData = cafeDoc.data();
              const shiftDef = (cafeData.shifts || []).find((s: any) => s.id === assignment.shiftId);
              
              if (shiftDef && shiftDef.startTime && shiftDef.endTime) {
                const [startH, startM] = shiftDef.startTime.split(':').map(Number);
                const [endH, endM] = shiftDef.endTime.split(':').map(Number);
                
                let durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
                if (durationMinutes < 0) durationMinutes += 24 * 60; // Crosses midnight
                
                totalSecondsForToday += (durationMinutes * 60);
              }
            }
          } catch (err) {
            console.error("Error fetching shift config", err);
          }
        }
      }

      // Set the dynamic duration. If they have shifts but none for today, it stays 0.
      setExpectedShiftSeconds(hasShiftToday && totalSecondsForToday > 0 ? totalSecondsForToday : 0);
    };

    computeDynamicShiftDuration();
  }, [userProfile]);

  useEffect(() => {
    if (!loginSessionId) {
      setStartTime(null);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "login_sessions", loginSessionId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.loginAt) {
            setStartTime(data.loginAt.toDate());
          }
          if (data.activeBreak) {
            setActiveBreak(data.activeBreak);
          } else {
            setActiveBreak(null);
          }
        }
      },
      (error) => console.error("SessionTimeTracker: Error", error)
    );

    return () => unsubscribe();
  }, [loginSessionId]);

  useEffect(() => {
    if (!startTime) return;

    const interval = setInterval(() => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      setElapsedSeconds(diff > 0 ? diff : 0);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  useEffect(() => {
    if (!activeBreak) return;

    const interval = setInterval(() => {
      const now = new Date();
      // Ensure we use a Date object since Firestore returns Timestamp via snap.data()
      const startedAtDate = activeBreak.startedAt.toDate ? activeBreak.startedAt.toDate() : new Date(activeBreak.startedAt);
      const diff = Math.floor((now.getTime() - startedAtDate.getTime()) / 1000);
      setBreakElapsedSeconds(diff > 0 ? diff : 0);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeBreak]);

  // Always render something so we can debug why it's hiding
  if (loginSessionError) {
    return (
      <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg border border-red-200 shadow-sm mr-4 text-xs text-red-500">
        <AlertTriangle className="h-3 w-3" /> Error: {loginSessionError}
      </div>
    );
  }

  if (!loginSessionId) {
    return (
      <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm mr-4 text-xs text-gray-500">
        <Clock className="h-3 w-3 animate-spin" /> Waiting for Session...
      </div>
    );
  }

  if (!startTime) {
    return (
      <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm mr-4 text-xs text-gray-500">
        <Clock className="h-3 w-3 animate-spin" /> Starting Timer...
      </div>
    );
  }

  if (expectedShiftSeconds === null) {
    return (
      <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm mr-4 text-xs text-gray-500">
        <Clock className="h-3 w-3 animate-spin" /> Calculating Shift...
      </div>
    );
  }

  // If HR hasn't assigned a shift for today
  if (expectedShiftSeconds === 0) {
    return (
      <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 shadow-sm mr-4 text-xs text-red-600 font-medium">
        <ShieldAlert className="h-4 w-4" /> No Shift Assigned Today
      </div>
    );
  }

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (activeBreak) {
     const totalBreakSeconds = activeBreak.durationMinutes * 60;
     const isBreakOvertime = breakElapsedSeconds > totalBreakSeconds;
     const breakTimeRemaining = isBreakOvertime ? 0 : totalBreakSeconds - breakElapsedSeconds;
     
     return (
       <div className="flex items-center gap-3 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 shadow-sm mr-4">
         <div className="flex items-center gap-2 border-r border-amber-200 pr-3">
           <Coffee className="h-4 w-4 text-amber-600 animate-pulse" />
           <div className="flex flex-col">
             <span className="text-[9px] text-amber-600 font-semibold uppercase leading-tight tracking-wider">{activeBreak.name}</span>
             <span className="text-sm font-mono font-bold text-amber-800 leading-tight">
               {isBreakOvertime ? `-${formatTime(breakElapsedSeconds - totalBreakSeconds)}` : formatTime(breakTimeRemaining)}
             </span>
           </div>
         </div>
         <Button 
           size="sm" 
           variant="outline" 
           className="h-6 text-xs bg-white text-amber-700 border-amber-200 hover:bg-amber-100 px-2"
           onClick={() => loginSessionService.endBreak(loginSessionId, activeBreak)}
         >
           End Break
         </Button>
       </div>
     )
  }

  const isOvertime = elapsedSeconds > expectedShiftSeconds;
  const timeRemaining = isOvertime ? 0 : expectedShiftSeconds - elapsedSeconds;
  const overtimeSeconds = isOvertime ? elapsedSeconds - expectedShiftSeconds : 0;
  const progressPercent = Math.min(100, (elapsedSeconds / expectedShiftSeconds) * 100);

  return (
    <div className="flex items-center gap-3 bg-white/10 px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm mr-4">
      {/* Active Session Timer */}
      <div className="flex items-center gap-2 border-r pr-3">
        <div className={`relative h-4 w-4 ${isOvertime ? 'text-amber-500' : 'text-green-500'}`}>
          <Clock className="h-4 w-4" />
          <span className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ${isOvertime ? 'bg-amber-500' : 'bg-green-500'} animate-pulse`} />
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] text-gray-500 font-semibold uppercase leading-tight tracking-wider">Session Active</span>
          <span className="text-sm font-mono font-bold text-gray-800 leading-tight">
            {formatTime(elapsedSeconds)}
          </span>
        </div>
      </div>

      {/* Shift Progress */}
      <div className="flex items-center gap-2">
        {isOvertime ? (
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        ) : (
          <Briefcase className="h-4 w-4 text-blue-500" />
        )}
        <div className="flex flex-col min-w-[70px]">
          <span className="text-[9px] text-gray-500 font-semibold uppercase leading-tight tracking-wider">
            {isOvertime ? "Overtime" : "Time Left"}
          </span>
          <span className={`text-sm font-mono font-bold leading-tight ${isOvertime ? 'text-amber-600' : 'text-blue-600'}`}>
            {isOvertime ? `+${formatTime(overtimeSeconds)}` : formatTime(timeRemaining)}
          </span>
        </div>
      </div>

      {/* Micro progress bar */}
      <div className="hidden lg:flex flex-col gap-0.5 min-w-[60px]">
        <span className="text-[9px] text-gray-400 font-medium">{Math.round(progressPercent)}%</span>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ${
              isOvertime ? 'bg-amber-500' : progressPercent > 75 ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />
        </div>
      </div>

      {/* Break Action */}
      {!activeBreak && userProfile.assignedBreaks && userProfile.assignedBreaks.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-full ml-1">
              <Coffee className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Start Break</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {userProfile.assignedBreaks.map(b => (
              <DropdownMenuItem 
                key={b.name} 
                className="cursor-pointer"
                onClick={() => loginSessionService.startBreak(loginSessionId, b.name, b.durationMinutes)}
              >
                <Coffee className="h-3 w-3 mr-2 text-amber-600" />
                {b.name} <span className="text-gray-400 ml-1">({b.durationMinutes}m)</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
