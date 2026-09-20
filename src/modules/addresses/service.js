import mongoose from 'mongoose';
import Address from './model.js';

const invalidId = () => { const error = new Error('Invalid address id'); error.statusCode = 400; return error; };

export const addressService = {
  async list(userId) { return Address.find({ user: userId }).sort({ isDefault: -1, createdAt: -1 }).lean(); },
  async get(userId, id) {
    if (!mongoose.isValidObjectId(id)) throw invalidId();
    const address = await Address.findOne({ _id: id, user: userId }).lean();
    if (!address) { const error = new Error('Address not found'); error.statusCode = 404; throw error; }
    return address;
  },
  async create(userId, payload) {
    if (payload.isDefault || !(await Address.exists({ user: userId }))) await Address.updateMany({ user: userId }, { $set: { isDefault: false } });
    return Address.create({ ...payload, user: userId });
  },
  async update(userId, id, payload) {
    if (!mongoose.isValidObjectId(id)) throw invalidId();
    if (payload.isDefault) await Address.updateMany({ user: userId, _id: { $ne: id } }, { $set: { isDefault: false } });
    const address = await Address.findOneAndUpdate({ _id: id, user: userId }, payload, { new: true, runValidators: true });
    if (!address) { const error = new Error('Address not found'); error.statusCode = 404; throw error; }
    return address;
  },
  async remove(userId, id) {
    if (!mongoose.isValidObjectId(id)) throw invalidId();
    const address = await Address.findOneAndDelete({ _id: id, user: userId });
    if (!address) { const error = new Error('Address not found'); error.statusCode = 404; throw error; }
    return true;
  },
  async setDefault(userId, id) { return this.update(userId, id, { isDefault: true }); },
};
