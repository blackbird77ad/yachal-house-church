import Notification from "../models/notificationModel.js";
import { markAsRead, markAllAsRead, getUnreadCount } from "../services/notificationService.js";

export const getMyNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const unreadCount = await getUnreadCount(req.user._id);

    res.status(200).json({ notifications, unreadCount });
  } catch (error) {
    next(error);
  }
};

export const markNotificationRead = async (req, res, next) => {
  try {
    const notification = await markAsRead(req.params.notificationId, req.user._id);
    if (!notification) {
      return res.status(404).json({ message: "Notification not found." });
    }
    res.status(200).json({ message: "Marked as read.", notification });
  } catch (error) {
    next(error);
  }
};

export const markAllNotificationsRead = async (req, res, next) => {
  try {
    await markAllAsRead(req.user._id);
    res.status(200).json({ message: "All notifications marked as read." });
  } catch (error) {
    next(error);
  }
};

export const getUnreadNotificationCount = async (req, res, next) => {
  try {
    const count = await getUnreadCount(req.user._id);
    res.status(200).json({ count });
  } catch (error) {
    next(error);
  }
};

export const deleteNotification = async (req, res, next) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.notificationId, recipient: req.user._id });
    res.status(200).json({ message: "Notification deleted." });
  } catch (error) {
    next(error);
  }
};