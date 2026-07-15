import { useEffect, useRef } from 'react';
import { useLicense } from '../state/license-context';

const THROTTLE_KEY = 'vantage.subNotify.lastAt';
const THROTTLE_MS = 23 * 60 * 60 * 1000; // ~24 h

async function sendNotification(title: string, body: string): Promise<void> {
  // Electron path: use the native IPC bridge which calls main-process Notification
  if (window.vantage?.notification) {
    await window.vantage.notification.show(title, body);
    return;
  }
  // Web browser path: use the Web Notification API
  if (!('Notification' in window)) return;
  const permission = await Notification.requestPermission().catch(() => 'denied' as NotificationPermission);
  if (permission === 'granted') {
    new Notification(title, { body });
  }
}

export function useSubscriptionNotification(): void {
  const { status } = useLicense();
  // Track the last state key we notified for — prevents re-firing in StrictMode
  // double-invocation and on every 60s poll when the status hasn't changed.
  const lastNotifiedKeyRef = useRef<string>('');

  useEffect(() => {
    if (!status) return;
    const { warningLevel, message, daysUntilExpiry, inGracePeriod, blocked } = status;

    // Nothing to notify for a healthy subscription
    if (warningLevel === 'none' && !inGracePeriod && !blocked) return;

    // Stable key for the current warning state — changes only when the
    // urgency level or remaining days cross a meaningful boundary
    const stateKey = `${blocked}:${inGracePeriod}:${warningLevel}:${daysUntilExpiry}`;
    if (lastNotifiedKeyRef.current === stateKey) return;

    // Throttle: one OS notification per ~24h even if the app is restarted
    const lastAt = localStorage.getItem(THROTTLE_KEY);
    if (lastAt && Date.now() - new Date(lastAt).getTime() < THROTTLE_MS) {
      lastNotifiedKeyRef.current = stateKey; // suppress within this session too
      return;
    }

    lastNotifiedKeyRef.current = stateKey;
    localStorage.setItem(THROTTLE_KEY, new Date().toISOString());

    let title: string;
    let body: string;

    if (blocked) {
      title = 'Subscription Blocked';
      body = message ?? 'Access has been suspended. Please contact your administrator to renew.';
    } else if (inGracePeriod) {
      title = 'Subscription Expired — Grace Period Active';
      body = message ?? 'Your subscription has expired. Please renew immediately to avoid losing access.';
    } else if (warningLevel === 'critical') {
      title = 'Subscription Expiring Soon';
      body = message ?? `Your subscription expires in ${daysUntilExpiry} day(s). Please renew now.`;
    } else {
      title = 'Subscription Renewal Reminder';
      body = message ?? `Your subscription expires in ${daysUntilExpiry} day(s). Please plan to renew.`;
    }

    void sendNotification(title, body);
  }, [status]);
}
