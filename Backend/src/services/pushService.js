import webpush from "web-push";
import PushSubscription from "../models/pushSubscriptionModel.js";
import { env } from "../config/env.js";

webpush.setVapidDetails(
  `mailto:${env.resendFrom}`,
  env.vapidPublicKey,
  env.vapidPrivateKey
);

export const sendPushToUser = async (userId, { title, body, icon, url }) => {
  try {
    const subs = await PushSubscription.find({ user: userId });
    if (!subs.length) return;

    const payload = JSON.stringify({
      title,
      body,
      icon: icon || "/icons/icon-192.png",
      badge: "/icons/icon-96.png",
      url: url || "/portal/dashboard",
      timestamp: Date.now(),
    });

    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload
        ).catch(async (err) => {
          // Remove expired or invalid subscriptions
          if (err.statusCode === 404 || err.statusCode === 410) {
            await PushSubscription.findByIdAndDelete(sub._id);
          }
          throw err;
        })
      )
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
  } catch (err) {
  }
};

export const sendPushToMany = async (userIds, payload) => {
  await Promise.allSettled(userIds.map((id) => sendPushToUser(id, payload)));
};

export const saveSubscription = async (userId, subscription, userAgent) => {
  await PushSubscription.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    { user: userId, ...subscription, userAgent },
    { upsert: true, new: true }
  );
};

export const removeSubscription = async (endpoint) => {
  await PushSubscription.findOneAndDelete({ endpoint });
};