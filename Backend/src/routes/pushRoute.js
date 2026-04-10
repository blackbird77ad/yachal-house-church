import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { saveSubscription, removeSubscription } from "../services/pushService.js";
import { env } from "../config/env.js";

const router = express.Router();

// Get VAPID public key (frontend needs this to subscribe)
router.get("/vapid-public-key", (req, res) => {
  res.json({ publicKey: env.vapidPublicKey });
});

// Save push subscription
router.post("/subscribe", protect, async (req, res, next) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint) return res.status(400).json({ message: "Invalid subscription." });
    await saveSubscription(req.user._id, subscription, req.headers["user-agent"]);
    res.status(201).json({ message: "Push subscription saved." });
  } catch (err) { next(err); }
});

// Remove push subscription (on logout or permission revoked)
router.post("/unsubscribe", protect, async (req, res, next) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) await removeSubscription(endpoint);
    res.json({ message: "Unsubscribed." });
  } catch (err) { next(err); }
});

export default router;