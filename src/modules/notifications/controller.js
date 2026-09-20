import { apiSuccess } from '../../utils/apiResponse.js';
import { notificationService } from './service.js';

export const notificationController = {
  list: async (req, res) => res.status(200).json(apiSuccess('Notifications fetched', { notifications: await notificationService.list(req.user._id) })),
  read: async (req, res) => res.status(200).json(apiSuccess('Notification marked read', { notification: await notificationService.markRead(req.user._id, req.params.id) })),
};
