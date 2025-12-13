import webpush from "web-push";
import { storage } from "./storage";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@americancoin.app";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

export async function sendPushNotification(endpoint: string, payload: NotificationPayload): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("VAPID keys not configured, skipping push notification");
    return false;
  }

  try {
    const subscription = await storage.getPushSubscription(endpoint);
    if (!subscription) {
      console.warn("Subscription not found for endpoint:", endpoint);
      return false;
    }

    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };

    await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
    return true;
  } catch (error: unknown) {
    const webPushError = error as { statusCode?: number };
    if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
      await storage.deletePushSubscription(endpoint);
      console.log("Removed expired subscription:", endpoint);
    } else {
      console.error("Error sending push notification:", error);
    }
    return false;
  }
}

export async function sendPushNotificationToUser(userId: string, payload: NotificationPayload): Promise<number> {
  const subscriptions = await storage.getPushSubscriptionsByUser(userId);
  let successCount = 0;

  for (const subscription of subscriptions) {
    const success = await sendPushNotification(subscription.endpoint, payload);
    if (success) successCount++;
  }

  return successCount;
}

export async function sendPushNotificationToAll(payload: NotificationPayload): Promise<number> {
  const subscriptions = await storage.getAllPushSubscriptions();
  let successCount = 0;

  for (const subscription of subscriptions) {
    const success = await sendPushNotification(subscription.endpoint, payload);
    if (success) successCount++;
  }

  return successCount;
}

export async function sendPriceAlertNotification(userId: string, symbol: string, currentPrice: number, targetPrice: number, condition: string): Promise<void> {
  const direction = condition === "above" ? "risen above" : "fallen below";
  const payload: NotificationPayload = {
    title: `${symbol} Price Alert`,
    body: `${symbol} has ${direction} your target of $${targetPrice.toFixed(2)}. Current price: $${currentPrice.toFixed(2)}`,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: `price-alert-${symbol}`,
    data: {
      type: "price_alert",
      symbol,
      currentPrice,
      targetPrice,
      condition,
    },
  };

  await sendPushNotificationToUser(userId, payload);
}

export async function sendTransactionNotification(userId: string, type: string, amount: string, currency: string, status: string): Promise<void> {
  const typeLabel = type === "receive" ? "received" : type === "send" ? "sent" : type;
  const payload: NotificationPayload = {
    title: `Transaction ${status === "completed" ? "Completed" : "Update"}`,
    body: `You ${typeLabel} ${amount} ${currency}`,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: `transaction-${Date.now()}`,
    data: {
      type: "transaction",
      transactionType: type,
      amount,
      currency,
      status,
    },
  };

  await sendPushNotificationToUser(userId, payload);
}

export async function checkPriceAlerts(): Promise<void> {
  try {
    const activeAlerts = await storage.getActivePriceAlerts();
    const prices = await storage.getTokenPrices();

    for (const alert of activeAlerts) {
      const tokenPrice = prices[alert.symbol];
      if (!tokenPrice) continue;

      const currentPrice = tokenPrice.price;
      const targetPrice = parseFloat(alert.targetPrice);
      let triggered = false;

      if (alert.condition === "above" && currentPrice >= targetPrice) {
        triggered = true;
      } else if (alert.condition === "below" && currentPrice <= targetPrice) {
        triggered = true;
      }

      if (triggered) {
        await sendPriceAlertNotification(alert.userId, alert.symbol, currentPrice, targetPrice, alert.condition);
        await storage.updatePriceAlert(alert.id, {
          isActive: "false",
          triggeredAt: new Date(),
        });
      }
    }
  } catch (error) {
    console.error("Error checking price alerts:", error);
  }
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

export function isNotificationsConfigured(): boolean {
  return !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}
