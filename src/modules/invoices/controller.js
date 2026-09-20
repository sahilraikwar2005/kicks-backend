import fs from 'node:fs';
import { apiSuccess } from '../../utils/apiResponse.js';
import { invoiceService } from './service.js';

export const invoiceController = {
  getCustomerInvoice: async (req, res) => {
    const invoice = await invoiceService.getForCustomer(req.params.id, req.user._id);
    res.type('application/pdf');
    return fs.createReadStream(invoice.filePath).pipe(res);
  },
  getAdminInvoice: async (req, res) => {
    const invoice = await invoiceService.getForAdmin(req.params.id);
    res.type('application/pdf');
    return fs.createReadStream(invoice.filePath).pipe(res);
  },
  resend: async (req, res) => {
    await invoiceService.resend(req.params.id);
    return res.status(200).json(apiSuccess('Invoice resent successfully', { ok: true }));
  },
};
