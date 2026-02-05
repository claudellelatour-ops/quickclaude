import { Response } from 'express';
import { vendorService } from './vendor.service';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../../utils/response';

export class VendorController {
  async list(req: AuthenticatedRequest, res: Response) {
    const result = await vendorService.getVendors(req.companyId!, req.query as any);
    return sendPaginated(res, result.vendors, result.pagination);
  }

  async get(req: AuthenticatedRequest, res: Response) {
    const vendor = await vendorService.getVendor(req.companyId!, req.params.id);
    return sendSuccess(res, vendor);
  }

  async create(req: AuthenticatedRequest, res: Response) {
    const vendor = await vendorService.createVendor(req.companyId!, req.body);
    return sendCreated(res, vendor, 'Vendor created successfully');
  }

  async update(req: AuthenticatedRequest, res: Response) {
    const vendor = await vendorService.updateVendor(
      req.companyId!,
      req.params.id,
      req.body
    );
    return sendSuccess(res, vendor, 'Vendor updated successfully');
  }

  async delete(req: AuthenticatedRequest, res: Response) {
    await vendorService.deactivateVendor(req.companyId!, req.params.id);
    return sendNoContent(res);
  }

  async getTransactions(req: AuthenticatedRequest, res: Response) {
    const transactions = await vendorService.getVendorTransactions(
      req.companyId!,
      req.params.id
    );
    return sendSuccess(res, transactions);
  }
}

export const vendorController = new VendorController();
