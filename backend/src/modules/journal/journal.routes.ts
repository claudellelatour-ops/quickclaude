import { Router } from 'express';
import { journalController } from './journal.controller';
import { validate, idParamSchema } from '../../middleware/validate';
import { authenticate, requireCompany, requireWriteAccess } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  createJournalEntrySchema,
  updateJournalEntrySchema,
  journalQuerySchema,
} from './journal.schema';
import { z } from 'zod';

const router = Router();

// All routes require authentication and company context
router.use(authenticate, requireCompany);

// List journal entries
router.get(
  '/',
  validate({ query: journalQuerySchema }),
  asyncHandler(journalController.list.bind(journalController))
);

// Get single entry
router.get(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(journalController.get.bind(journalController))
);

// Create entry
router.post(
  '/',
  requireWriteAccess,
  validate({ body: createJournalEntrySchema }),
  asyncHandler(journalController.create.bind(journalController))
);

// Update entry
router.put(
  '/:id',
  requireWriteAccess,
  validate({ params: idParamSchema, body: updateJournalEntrySchema }),
  asyncHandler(journalController.update.bind(journalController))
);

// Void entry
router.delete(
  '/:id',
  requireWriteAccess,
  validate({ params: idParamSchema }),
  asyncHandler(journalController.void.bind(journalController))
);

// Create reversing entry
router.post(
  '/:id/reverse',
  requireWriteAccess,
  validate({
    params: idParamSchema,
    body: z.object({
      date: z.string().datetime().optional(),
    }),
  }),
  asyncHandler(journalController.reverse.bind(journalController))
);

// General ledger for an account
router.get(
  '/account/:accountId/ledger',
  validate({
    params: z.object({ accountId: z.string().uuid() }),
    query: z.object({
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    }),
  }),
  asyncHandler(journalController.generalLedger.bind(journalController))
);

export default router;
