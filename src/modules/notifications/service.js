import Notification from './model.js';

export const notificationService = {
  create: (payload) => Notification.create(payload),
  list: (userId) => Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(50).lean(),
  markRead: async (userId, id) => Notification.findOneAndUpdate({ _id: id, user: userId }, { readAt: new Date() }, { new: true }),
};
