import { Response } from 'express';
import { billPaymentService } from './billPayment.service';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../../utils/response';

export class BillPaymentController {
  async list(req: AuthenticatedRequest, res: Response) {
    const result = await billPaymentService.getPayments(req.companyId!, req.query as any);
    return sendPaginated(res, result.payments, result.pagination);
  }

  async get(req: AuthenticatedRequest, res: Response) {
    const payment = await billPaymentService.getPayment(req.companyId!, req.params.id);
    return sendSuccess(res, payment);
  }

  async create(req: AuthenticatedRequest, res: Response) {
    const payment = await billPaymentService.createPayment(
      req.companyId!,
      req.user!.id,
      req.body
    );
    return sendCreated(res, payment, 'Payment recorded successfully');
  }

  async delete(req: AuthenticatedRequest, res: Response) {
    await billPaymentService.deletePayment(req.companyId!, req.params.id);
    return sendNoContent(res);
  }
}

export const billPaymentController = new BillPaymentController();
