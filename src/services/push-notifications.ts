/**
 * push-notifications.ts — Browser push notification helpers for Survai scan
 * completion alerts and other time-sensitive events.
 *
 * Uses the Web Notifications API (local notifications, no service worker
 * registration required for basic use).
 */

// ── Feature detection ────────────────────────────────────────────────────────

/**
 * Check whether the Notification API is available in this browser.
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

// ── Permission ───────────────────────────────────────────────────────────────

/**
 * Request notification permission from the user.
 *
 * Should be called in response to a user action (e.g. first scan upload),
 * NOT on page load — browsers will block the request otherwise.
 *
 * @returns true if permission was granted, false otherwise
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;

  // Already granted
  if (Notification.permission === 'granted') return true;

  // Already denied — can't re-ask
  if (Notification.permission === 'denied') return false;

  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    // Older browsers use callback-based API
    return false;
  }
}

// ── Send notification ────────────────────────────────────────────────────────

/**
 * Send a local browser notification.
 *
 * This is a no-op if notifications are not supported or permission has not
 * been granted. Callers do not need to pre-check — it degrades gracefully.
 *
 * @param title - Notification title
 * @param body - Notification body text
 * @param options - Additional NotificationOptions (icon, tag, etc.)
 */
export function sendLocalNotification(
  title: string,
  body: string,
  options?: NotificationOptions,
): void {
  if (!isNotificationSupported()) return;
  if (Notification.permission !== 'granted') return;

  try {
    new Notification(title, {
      body,
      icon: '/icons/icon-192.svg',
      ...options,
    });
  } catch {
    // Silently fail — notifications are a nice-to-have, not critical
  }
}
