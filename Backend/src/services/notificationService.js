import Notification from "../models/notificationModel.js";

export const createNotification = async (recipientId, { type, title, message, link, senderId }) => {
  return await Notification.create({
    recipient: recipientId,
    sender: senderId || null,
    type,
    title,
    message,
    link: link || null,
  });
};

export const createBulkNotification = async (recipientIds, { type, title, message, link, senderId }) => {
  const notifications = recipientIds.map((id) => ({
    recipient: id,
    sender: senderId || null,
    type,
    title,
    message,
    link: link || null,
  }));

  return await Notification.insertMany(notifications);
};

export const markAsRead = async (notificationId, userId) => {
  return await Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { isRead: true, readAt: new Date() },
    { new: true }
  );
};

export const markAllAsRead = async (userId) => {
  return await Notification.updateMany(
    { recipient: userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
};

export const getUnreadCount = async (userId) => {
  return await Notification.countDocuments({ recipient: userId, isRead: false });
};