import { Response } from 'express';
import { customerService } from './customer.service';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../../utils/response';

export class CustomerController {
  async list(req: AuthenticatedRequest, res: Response) {
    const result = await customerService.getCustomers(req.companyId!, req.query as any);
    return sendPaginated(res, result.customers, result.pagination);
  }

  async get(req: AuthenticatedRequest, res: Response) {
    const customer = await customerService.getCustomer(req.companyId!, req.params.id);
    return sendSuccess(res, customer);
  }

  async create(req: AuthenticatedRequest, res: Response) {
    const customer = await customerService.createCustomer(req.companyId!, req.body);
    return sendCreated(res, customer, 'Customer created successfully');
  }

  async update(req: AuthenticatedRequest, res: Response) {
    const customer = await customerService.updateCustomer(
      req.companyId!,
      req.params.id,
      req.body
    );
    return sendSuccess(res, customer, 'Customer updated successfully');
  }

  async delete(req: AuthenticatedRequest, res: Response) {
    await customerService.deactivateCustomer(req.companyId!, req.params.id);
    return sendNoContent(res);
  }

  async getTransactions(req: AuthenticatedRequest, res: Response) {
    const transactions = await customerService.getCustomerTransactions(
      req.companyId!,
      req.params.id
    );
    return sendSuccess(res, transactions);
  }
}

export const customerController = new CustomerController();
