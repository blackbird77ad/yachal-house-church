import { useState, useEffect } from "react";
import axiosInstance from "../utils/axiosInstance";

export const usePushNotifications = () => {
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [subscribed, setSubscribed] = useState(false);

  const urlBase64ToUint8Array = (base64String) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
  };

  const subscribe = async () => {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        return false;
      }

      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return false;

      // Get VAPID public key from backend
      const { data } = await axiosInstance.get("/push/vapid-public-key");
      if (!data.publicKey) return false;

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });

      await axiosInstance.post("/push/subscribe", { subscription });
      setSubscribed(true);
      return true;
    } catch (err) {
      return false;
    }
  };

  const unsubscribe = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await axiosInstance.post("/push/unsubscribe", { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setSubscribed(false);
    } catch (err) {
    }
  };

  // Check if already subscribed on mount
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setSubscribed(!!sub);
      });
    });
  }, []);

  return { permission, subscribed, subscribe, unsubscribe };
};