import { Response } from 'express';
import { invoiceService } from './invoice.service';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../../utils/response';

export class InvoiceController {
  async list(req: AuthenticatedRequest, res: Response) {
    const result = await invoiceService.getInvoices(req.companyId!, req.query as any);
    return sendPaginated(res, result.invoices, result.pagination);
  }

  async get(req: AuthenticatedRequest, res: Response) {
    const invoice = await invoiceService.getInvoice(req.companyId!, req.params.id);
    return sendSuccess(res, invoice);
  }

  async create(req: AuthenticatedRequest, res: Response) {
    const invoice = await invoiceService.createInvoice(
      req.companyId!,
      req.user!.id,
      req.body
    );
    return sendCreated(res, invoice, 'Invoice created successfully');
  }

  async update(req: AuthenticatedRequest, res: Response) {
    const invoice = await invoiceService.updateInvoice(
      req.companyId!,
      req.user!.id,
      req.params.id,
      req.body
    );
    return sendSuccess(res, invoice, 'Invoice updated successfully');
  }

  async send(req: AuthenticatedRequest, res: Response) {
    const invoice = await invoiceService.sendInvoice(
      req.companyId!,
      req.user!.id,
      req.params.id
    );
    return sendSuccess(res, invoice, 'Invoice sent successfully');
  }

  async void(req: AuthenticatedRequest, res: Response) {
    await invoiceService.voidInvoice(req.companyId!, req.params.id);
    return sendSuccess(res, null, 'Invoice voided');
  }
}

export const invoiceController = new InvoiceController();
