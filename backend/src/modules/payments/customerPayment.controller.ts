import { Response } from 'express';
import { customerPaymentService } from './customerPayment.service';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../../utils/response';

export class CustomerPaymentController {
  async list(req: AuthenticatedRequest, res: Response) {
    const result = await customerPaymentService.getPayments(req.companyId!, req.query as any);
    return sendPaginated(res, result.payments, result.pagination);
  }

  async get(req: AuthenticatedRequest, res: Response) {
    const payment = await customerPaymentService.getPayment(req.companyId!, req.params.id);
    return sendSuccess(res, payment);
  }

  async create(req: AuthenticatedRequest, res: Response) {
    const payment = await customerPaymentService.createPayment(
      req.companyId!,
      req.user!.id,
      req.body
    );
    return sendCreated(res, payment, 'Payment recorded successfully');
  }

  async delete(req: AuthenticatedRequest, res: Response) {
    await customerPaymentService.deletePayment(req.companyId!, req.params.id);
    return sendNoContent(res);
  }
}

export const customerPaymentController = new CustomerPaymentController();
