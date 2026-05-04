import webpush from "web-push";
import PushSubscription from "../models/pushSubscriptionModel.js";
import User from "../models/userModel.js";
import { env } from "../config/env.js";

// Only init VAPID if keys are set - prevents crash if not configured yet
let vapidReady = false;
if (env.vapidPublicKey && env.vapidPrivateKey) {
  try {
    webpush.setVapidDetails(
      `mailto:${env.resendFrom}`,
      env.vapidPublicKey,
      env.vapidPrivateKey
    );
    vapidReady = true;
  } catch (e) {
    console.warn("VAPID setup failed - push notifications disabled:", e.message);
  }
}

export const sendPushToUser = async (userId, { title, body, icon, url }) => {
  try {
    if (!vapidReady) return;
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
  const uniqueIds = [...new Set((userIds || []).map((id) => String(id)))];
  if (!uniqueIds.length) return;

  const pushEnabledUsers = await User.find({
    _id: { $in: uniqueIds },
    $or: [
      { "notificationPreferences.push": { $exists: false } },
      { "notificationPreferences.push": { $ne: false } },
    ],
  })
    .select("_id")
    .lean();

  await Promise.allSettled(
    pushEnabledUsers.map((user) => sendPushToUser(user._id, payload))
  );
};

export const saveSubscription = async (userId, subscription, userAgent) => {
  await PushSubscription.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    { user: userId, ...subscription, userAgent },
    { upsert: true, new: true }
  );
  await User.findByIdAndUpdate(userId, {
    $set: { "notificationPreferences.push": true },
  }).catch(() => {});
};

export const removeSubscription = async (endpoint) => {
  await PushSubscription.findOneAndDelete({ endpoint });
};
