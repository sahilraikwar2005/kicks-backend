import mongoose from 'mongoose';

const adminSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: mongoose.Schema.Types.Mixed, default: {} },
    description: { type: String, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

const AdminSetting = mongoose.model('AdminSetting', adminSettingSchema);

export default AdminSetting;
