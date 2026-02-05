import { Response } from 'express';
import { journalService } from './journal.service';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../../utils/response';

export class JournalController {
  /**
   * List journal entries
   */
  async list(req: AuthenticatedRequest, res: Response) {
    const result = await journalService.getJournalEntries(req.companyId!, req.query as any);
    return sendPaginated(res, result.entries, result.pagination);
  }

  /**
   * Get single journal entry
   */
  async get(req: AuthenticatedRequest, res: Response) {
    const entry = await journalService.getJournalEntry(req.companyId!, req.params.id);
    return sendSuccess(res, entry);
  }

  /**
   * Create journal entry
   */
  async create(req: AuthenticatedRequest, res: Response) {
    const entry = await journalService.createJournalEntry(
      req.companyId!,
      req.user!.id,
      req.body
    );
    return sendCreated(res, entry, 'Journal entry created successfully');
  }

  /**
   * Update journal entry
   */
  async update(req: AuthenticatedRequest, res: Response) {
    const entry = await journalService.updateJournalEntry(
      req.companyId!,
      req.params.id,
      req.body
    );
    return sendSuccess(res, entry, 'Journal entry updated successfully');
  }

  /**
   * Void journal entry
   */
  async void(req: AuthenticatedRequest, res: Response) {
    await journalService.voidJournalEntry(req.companyId!, req.params.id);
    return sendSuccess(res, null, 'Journal entry voided');
  }

  /**
   * Create reversing entry
   */
  async reverse(req: AuthenticatedRequest, res: Response) {
    const reverseDate = req.body.date ? new Date(req.body.date) : undefined;
    const entry = await journalService.reverseJournalEntry(
      req.companyId!,
      req.user!.id,
      req.params.id,
      reverseDate
    );
    return sendCreated(res, entry, 'Reversing entry created');
  }

  /**
   * Get general ledger for an account
   */
  async generalLedger(req: AuthenticatedRequest, res: Response) {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const ledger = await journalService.getGeneralLedger(
      req.companyId!,
      req.params.accountId,
      startDate,
      endDate
    );
    return sendSuccess(res, ledger);
  }
}

export const journalController = new JournalController();
