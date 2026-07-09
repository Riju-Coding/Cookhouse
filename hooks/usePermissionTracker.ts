import { useEffect, useRef } from 'react';
import { loginSessionService } from '../lib/firestore/loginSessionService';
import { Timestamp } from 'firebase/firestore';

interface PermissionTrackerOptions {
  sessionId?: string | null;
}

export function usePermissionTracker({ sessionId }: PermissionTrackerOptions) {
  const denials = useRef<{ permission: string; deniedAt: Timestamp }[]>([]);
  const hasChecked = useRef(false);

  useEffect(() => {
    if (!sessionId || hasChecked.current) return;
    hasChecked.current = true;

    const checkPermissions = async () => {
      const status: any = {
        notification: 'unsupported',
        camera: 'unsupported',
        microphone: 'unsupported',
        location: 'unsupported'
      };

      // Check Notification API
      if ('Notification' in window) {
        status.notification = Notification.permission; // 'granted' | 'denied' | 'default'
        if (Notification.permission === 'default') {
          // Request permission and track the response
          try {
            const result = await Notification.requestPermission();
            status.notification = result;
            if (result === 'denied') {
              denials.current.push({ permission: 'notification', deniedAt: Timestamp.now() });
            }
          } catch {
            status.notification = 'denied';
            denials.current.push({ permission: 'notification', deniedAt: Timestamp.now() });
          }
        } else if (Notification.permission === 'denied') {
          denials.current.push({ permission: 'notification', deniedAt: Timestamp.now() });
        }
      }

      // Check Permissions API for camera, microphone, geolocation
      if (navigator.permissions) {
        const permNames: Array<{ name: PermissionName; key: string }> = [
          { name: 'camera' as PermissionName, key: 'camera' },
          { name: 'microphone' as PermissionName, key: 'microphone' },
          { name: 'geolocation' as PermissionName, key: 'location' },
        ];

        for (const perm of permNames) {
          try {
            const result = await navigator.permissions.query({ name: perm.name });
            status[perm.key] = result.state; // 'granted' | 'denied' | 'prompt'
            if (result.state === 'denied') {
              denials.current.push({ permission: perm.key, deniedAt: Timestamp.now() });
            }
            // Listen for future changes
            result.onchange = () => {
              status[perm.key] = result.state;
              if (result.state === 'denied') {
                denials.current.push({ permission: perm.key, deniedAt: Timestamp.now() });
              }
              // Update Firestore on change
              loginSessionService.updatePermissionStatus(sessionId, status, denials.current).catch(console.error);
            };
          } catch {
            // Permission name not supported in this browser
            status[perm.key] = 'unsupported';
          }
        }
      }

      // Save initial status to Firestore
      await loginSessionService.updatePermissionStatus(sessionId, status, denials.current).catch(console.error);
    };

    // Small delay to let the page load first
    const timeout = setTimeout(checkPermissions, 2000);
    return () => clearTimeout(timeout);
  }, [sessionId]);
}
