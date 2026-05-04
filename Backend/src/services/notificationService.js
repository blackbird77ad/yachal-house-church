// Backend/src/services/notificationService.js
import Notification from "../models/notificationModel.js";
import User from "../models/userModel.js";

export const createNotification = async (userId, { type, title, message, link, senderId }) => {
  try {
    const recipient = await User.findById(userId).select("notificationPreferences").lean();
    if (!recipient || recipient.notificationPreferences?.inApp === false) {
      return null;
    }

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

export const createBulkNotification = async (
  userIds,
  { type, title, message, link, senderId }
) => {
  try {
    if (!userIds || userIds.length === 0) return;
    const recipients = await User.find({
      _id: { $in: userIds },
      $or: [
        { "notificationPreferences.inApp": { $exists: false } },
        { "notificationPreferences.inApp": { $ne: false } },
      ],
    })
      .select("_id")
      .lean();

    if (!recipients.length) return;

    const docs = recipients.map(({ _id }) => ({
      recipient: _id,
      sender: senderId || null,
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

export const getUnreadCount = async (userId) => {
  try {
    return await Notification.countDocuments({ recipient: userId, isRead: false });
  } catch (err) {
    return 0;
  }
};

export const markAsRead = async (notificationId, userId) => {
  try {
    return await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
  } catch (err) {
    console.error("markAsRead error:", err.message);
  }
};

export const markAllAsRead = async (userId) => {
  try {
    return await Notification.updateMany(
      { recipient: userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );
  } catch (err) {
    console.error("markAllAsRead error:", err.message);
  }
};

export const deleteNotification = async (notificationId, userId) => {
  try {
    return await Notification.findOneAndDelete({ _id: notificationId, recipient: userId });
  } catch (err) {
    console.error("deleteNotification error:", err.message);
  }
};
