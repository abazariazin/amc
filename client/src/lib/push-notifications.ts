import { apiRequest } from "./api";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function getVapidPublicKey(): Promise<{ publicKey: string; configured: boolean }> {
  const response = await fetch('/api/push/vapid-public-key');
  return response.json();
}

export async function isPushSupported(): Promise<boolean> {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service worker registered:', registration.scope);
    return registration;
  } catch (error) {
    console.error('Service worker registration failed:', error);
    return null;
  }
}

export async function getNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.requestPermission();
}

export async function subscribeToPush(userId?: string): Promise<PushSubscription | null> {
  try {
    const supported = await isPushSupported();
    if (!supported) {
      console.warn('Push notifications not supported');
      return null;
    }

    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission denied');
      return null;
    }

    const registration = await registerServiceWorker();
    if (!registration) {
      return null;
    }

    const { publicKey, configured } = await getVapidPublicKey();
    if (!configured || !publicKey) {
      console.warn('VAPID keys not configured on server');
      return null;
    }

    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      await saveSubscriptionToServer(existingSubscription, userId);
      return existingSubscription;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    await saveSubscriptionToServer(subscription, userId);
    return subscription;
  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
    return null;
  }
}

async function saveSubscriptionToServer(subscription: PushSubscription, userId?: string): Promise<void> {
  const subscriptionJSON = subscription.toJSON();
  
  await apiRequest('POST', '/api/push/subscribe', {
    subscription: {
      endpoint: subscriptionJSON.endpoint,
      keys: {
        p256dh: subscriptionJSON.keys?.p256dh,
        auth: subscriptionJSON.keys?.auth,
      },
    },
    userId,
  });
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await apiRequest('POST', '/api/push/unsubscribe', { endpoint: subscription.endpoint });
      await subscription.unsubscribe();
    }
    
    return true;
  } catch (error) {
    console.error('Failed to unsubscribe from push notifications:', error);
    return false;
  }
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  try {
    if (!('serviceWorker' in navigator)) {
      return null;
    }
    
    const registration = await navigator.serviceWorker.ready;
    return registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export interface PriceAlert {
  id: string;
  userId: string;
  symbol: string;
  targetPrice: string;
  condition: string;
  isActive: string;
  createdAt: string;
  triggeredAt: string | null;
}

export async function getPriceAlerts(userId: string): Promise<PriceAlert[]> {
  const response = await fetch(`/api/price-alerts/${userId}`);
  return response.json();
}

export async function createPriceAlert(data: {
  userId: string;
  symbol: string;
  targetPrice: string;
  condition: string;
}): Promise<PriceAlert> {
  const response = await apiRequest('POST', '/api/price-alerts', data);
  return response.json();
}

export async function deletePriceAlert(id: string): Promise<void> {
  await apiRequest('DELETE', `/api/price-alerts/${id}`);
}
