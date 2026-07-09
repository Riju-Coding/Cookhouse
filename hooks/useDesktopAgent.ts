import { useEffect, useState } from "react";
import { loginSessionService } from "@/lib/firestore/loginSessionService";

export function useDesktopAgent(loginSessionId: string | null) {
  const [isDesktop, setIsDesktop] = useState(false);
  const [currentApp, setCurrentApp] = useState<{title: string, ownerName: string, url: string | null} | null>(null);

  useEffect(() => {
    // Check if we are running inside the Electron wrapper
    if (typeof window !== 'undefined' && (window as any).desktopAgent?.isDesktop) {
      setIsDesktop(true);
      const desktopAgent = (window as any).desktopAgent;

      // 1. Subscribe to Active Window/Tab changes
      desktopAgent.onActiveAppChanged((appInfo: any) => {
        setCurrentApp(appInfo);
      });

      // 2. Subscribe to Keystrokes & Mouse Clicks (Activity Level)
      desktopAgent.onActivityLevelUpdate((data: { keystrokes: number, mouseClicks: number, timestamp: string }) => {
        if (loginSessionId) {
          loginSessionService.recordDeepActivity(loginSessionId, {
            ...data,
            appInfo: currentApp // Send what app they were using during this activity period
          }).catch(console.error);
        }
      });

      // 3. Subscribe to Screenshots
      desktopAgent.onScreenshotCaptured((data: { image: string, timestamp: string }) => {
        if (loginSessionId) {
          loginSessionService.saveScreenshot(loginSessionId, data.image, data.timestamp).catch(console.error);
        }
      });
    }
  }, [loginSessionId, currentApp]);

  return {
    isDesktop,
    currentApp
  };
}
