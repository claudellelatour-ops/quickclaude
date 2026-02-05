import { Response } from 'express';
import { accountService } from './account.service';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response';

export class AccountController {
  /**
   * List accounts
   */
  async list(req: AuthenticatedRequest, res: Response) {
    const accounts = await accountService.getAccounts(req.companyId!, req.query as any);
    return sendSuccess(res, accounts);
  }

  /**
   * Get single account
   */
  async get(req: AuthenticatedRequest, res: Response) {
    const account = await accountService.getAccount(req.companyId!, req.params.id);
    return sendSuccess(res, account);
  }

  /**
   * Create account
   */
  async create(req: AuthenticatedRequest, res: Response) {
    const account = await accountService.createAccount(req.companyId!, req.body);
    return sendCreated(res, account, 'Account created successfully');
  }

  /**
   * Update account
   */
  async update(req: AuthenticatedRequest, res: Response) {
    const account = await accountService.updateAccount(
      req.companyId!,
      req.params.id,
      req.body
    );
    return sendSuccess(res, account, 'Account updated successfully');
  }

  /**
   * Delete/deactivate account
   */
  async delete(req: AuthenticatedRequest, res: Response) {
    await accountService.deactivateAccount(req.companyId!, req.params.id);
    return sendNoContent(res);
  }

  /**
   * Import default chart of accounts
   */
  async importTemplate(req: AuthenticatedRequest, res: Response) {
    const template = req.body.template || 'service';
    const result = await accountService.importDefaultChart(req.companyId!, template);
    return sendSuccess(res, result, `Imported ${result.count} accounts`);
  }
}

export const accountController = new AccountController();
