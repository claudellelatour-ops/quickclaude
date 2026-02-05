import { Router } from 'express';
import { bankingController } from './banking.controller';
import { validate, idParamSchema } from '../../middleware/validate';
import { authenticate, requireCompany, requireWriteAccess } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  createBankAccountSchema,
  updateBankAccountSchema,
  importTransactionsSchema,
  categorizeTransactionSchema,
  matchTransactionSchema,
  startReconciliationSchema,
  completeReconciliationSchema,
  bankTransactionQuerySchema,
} from './banking.schema';
import { z } from 'zod';

const router = Router();

router.use(authenticate, requireCompany);

// Bank accounts
router.get(
  '/',
  asyncHandler(bankingController.listAccounts.bind(bankingController))
);

router.get(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(bankingController.getAccount.bind(bankingController))
);

router.post(
  '/',
  requireWriteAccess,
  validate({ body: createBankAccountSchema }),
  asyncHandler(bankingController.createAccount.bind(bankingController))
);

router.put(
  '/:id',
  requireWriteAccess,
  validate({ params: idParamSchema, body: updateBankAccountSchema }),
  asyncHandler(bankingController.updateAccount.bind(bankingController))
);

// Transactions
router.get(
  '/:id/transactions',
  validate({ params: idParamSchema, query: bankTransactionQuerySchema }),
  asyncHandler(bankingController.getTransactions.bind(bankingController))
);

router.post(
  '/:id/import',
  requireWriteAccess,
  validate({ params: idParamSchema, body: importTransactionsSchema }),
  asyncHandler(bankingController.importTransactions.bind(bankingController))
);

router.post(
  '/transactions/:transactionId/categorize',
  requireWriteAccess,
  validate({
    params: z.object({ transactionId: z.string().uuid() }),
    body: categorizeTransactionSchema,
  }),
  asyncHandler(bankingController.categorizeTransaction.bind(bankingController))
);

router.post(
  '/transactions/:transactionId/match',
  requireWriteAccess,
  validate({
    params: z.object({ transactionId: z.string().uuid() }),
    body: matchTransactionSchema,
  }),
  asyncHandler(bankingController.matchTransaction.bind(bankingController))
);

// Reconciliation
router.post(
  '/:id/reconcile',
  requireWriteAccess,
  validate({ params: idParamSchema, body: startReconciliationSchema }),
  asyncHandler(bankingController.startReconciliation.bind(bankingController))
);

router.post(
  '/reconciliations/:reconciliationId/complete',
  requireWriteAccess,
  validate({
    params: z.object({ reconciliationId: z.string().uuid() }),
    body: completeReconciliationSchema,
  }),
  asyncHandler(bankingController.completeReconciliation.bind(bankingController))
);

export default router;
