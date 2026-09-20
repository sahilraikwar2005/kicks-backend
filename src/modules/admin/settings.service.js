import AdminSetting from './settings.model.js';

export const adminSettingsService = {
  async list() {
    return AdminSetting.find().sort({ key: 1 }).lean();
  },

  async get(key) {
    return AdminSetting.findOne({ key }).lean();
  },

  async upsert(key, value, description = '', updatedBy = null) {
    return AdminSetting.findOneAndUpdate(
      { key },
      { $set: { value, description, updatedBy } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  },
};
