import { Response } from 'express';
import { bankingService } from './banking.service';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response';

export class BankingController {
  async listAccounts(req: AuthenticatedRequest, res: Response) {
    const accounts = await bankingService.getBankAccounts(req.companyId!);
    return sendSuccess(res, accounts);
  }

  async getAccount(req: AuthenticatedRequest, res: Response) {
    const account = await bankingService.getBankAccount(req.companyId!, req.params.id);
    return sendSuccess(res, account);
  }

  async createAccount(req: AuthenticatedRequest, res: Response) {
    const account = await bankingService.createBankAccount(req.companyId!, req.body);
    return sendCreated(res, account, 'Bank account created successfully');
  }

  async updateAccount(req: AuthenticatedRequest, res: Response) {
    const account = await bankingService.updateBankAccount(
      req.companyId!,
      req.params.id,
      req.body
    );
    return sendSuccess(res, account, 'Bank account updated successfully');
  }

  async getTransactions(req: AuthenticatedRequest, res: Response) {
    const result = await bankingService.getTransactions(
      req.companyId!,
      req.params.id,
      req.query as any
    );
    return sendPaginated(res, result.transactions, result.pagination);
  }

  async importTransactions(req: AuthenticatedRequest, res: Response) {
    const result = await bankingService.importTransactions(
      req.companyId!,
      req.params.id,
      req.body.data,
      req.body.format
    );
    return sendSuccess(res, result, `Imported ${result.imported} transactions`);
  }

  async categorizeTransaction(req: AuthenticatedRequest, res: Response) {
    const transaction = await bankingService.categorizeTransaction(
      req.companyId!,
      req.user!.id,
      req.params.transactionId,
      req.body
    );
    return sendSuccess(res, transaction, 'Transaction categorized');
  }

  async matchTransaction(req: AuthenticatedRequest, res: Response) {
    const transaction = await bankingService.matchTransaction(
      req.companyId!,
      req.params.transactionId,
      req.body
    );
    return sendSuccess(res, transaction, 'Transaction matched');
  }

  async startReconciliation(req: AuthenticatedRequest, res: Response) {
    const reconciliation = await bankingService.startReconciliation(
      req.companyId!,
      req.params.id,
      req.body
    );
    return sendCreated(res, reconciliation, 'Reconciliation started');
  }

  async completeReconciliation(req: AuthenticatedRequest, res: Response) {
    const reconciliation = await bankingService.completeReconciliation(
      req.companyId!,
      req.user!.id,
      req.params.reconciliationId,
      req.body.transactionIds
    );
    return sendSuccess(res, reconciliation, 'Reconciliation completed');
  }
}

export const bankingController = new BankingController();
