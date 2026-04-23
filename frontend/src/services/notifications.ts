import { notificationsApi } from './api';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (err) {
    console.error('[SW] Registration failed:', err);
    return null;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export async function subscribeToPush(registration: ServiceWorkerRegistration): Promise<boolean> {
  try {
    const { key } = await notificationsApi.getVapidKey();
    if (!key) {
      console.warn('[Push] No VAPID key — notifications disabled');
      return false;
    }

    const applicationServerKey = urlBase64ToUint8Array(key).buffer as ArrayBuffer;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    await notificationsApi.subscribe(subscription.toJSON());
    return true;
  } catch (err) {
    console.error('[Push] Subscription failed:', err);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator)) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return false;
    await notificationsApi.unsubscribe(sub.endpoint);
    await sub.unsubscribe();
    return true;
  } catch (err) {
    console.error('[Push] Unsubscribe failed:', err);
    return false;
  }
}

export async function getSubscriptionState(): Promise<'subscribed' | 'not-subscribed' | 'unsupported'> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return 'not-subscribed';
    const sub = await reg.pushManager.getSubscription();
    return sub ? 'subscribed' : 'not-subscribed';
  } catch {
    return 'not-subscribed';
  }
}

export function getPermissionStatus(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}
