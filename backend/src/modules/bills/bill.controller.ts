import { Response } from 'express';
import { billService } from './bill.service';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../../utils/response';

export class BillController {
  async list(req: AuthenticatedRequest, res: Response) {
    const result = await billService.getBills(req.companyId!, req.query as any);
    return sendPaginated(res, result.bills, result.pagination);
  }

  async get(req: AuthenticatedRequest, res: Response) {
    const bill = await billService.getBill(req.companyId!, req.params.id);
    return sendSuccess(res, bill);
  }

  async create(req: AuthenticatedRequest, res: Response) {
    const bill = await billService.createBill(
      req.companyId!,
      req.user!.id,
      req.body
    );
    return sendCreated(res, bill, 'Bill created successfully');
  }

  async update(req: AuthenticatedRequest, res: Response) {
    const bill = await billService.updateBill(
      req.companyId!,
      req.user!.id,
      req.params.id,
      req.body
    );
    return sendSuccess(res, bill, 'Bill updated successfully');
  }

  async void(req: AuthenticatedRequest, res: Response) {
    await billService.voidBill(req.companyId!, req.params.id);
    return sendSuccess(res, null, 'Bill voided');
  }
}

export const billController = new BillController();
