// Backend/src/services/notificationService.js
import Notification from "../models/notificationModel.js";

export const createNotification = async (userId, { type, title, message, link, senderId }) => {
  try {
    return await Notification.create({
      recipient: userId,
      sender: senderId || null,
      type: type || "general",
      title,
      message,
      link: link || null,
      isRead: false,
    });
  } catch (err) {
    console.error("createNotification error:", err.message);
  }
};

export const createBulkNotification = async (userIds, { type, title, message, link }) => {
  try {
    if (!userIds || userIds.length === 0) return;
    const docs = userIds.map((userId) => ({
      recipient: userId,
      type: type || "general",
      title,
      message,
      link: link || null,
      isRead: false,
    }));
    return await Notification.insertMany(docs, { ordered: false });
  } catch (err) {
    console.error("createBulkNotification error:", err.message);
  }
};