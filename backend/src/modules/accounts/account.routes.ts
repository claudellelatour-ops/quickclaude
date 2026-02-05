import { Router } from 'express';
import { accountController } from './account.controller';
import { validate, idParamSchema } from '../../middleware/validate';
import { authenticate, requireCompany, requireWriteAccess } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  createAccountSchema,
  updateAccountSchema,
  accountQuerySchema,
} from './account.schema';
import { z } from 'zod';

const router = Router();

// All routes require authentication and company context
router.use(authenticate, requireCompany);

// List accounts
router.get(
  '/',
  validate({ query: accountQuerySchema }),
  asyncHandler(accountController.list.bind(accountController))
);

// Get single account
router.get(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(accountController.get.bind(accountController))
);

// Create account
router.post(
  '/',
  requireWriteAccess,
  validate({ body: createAccountSchema }),
  asyncHandler(accountController.create.bind(accountController))
);

// Update account
router.put(
  '/:id',
  requireWriteAccess,
  validate({ params: idParamSchema, body: updateAccountSchema }),
  asyncHandler(accountController.update.bind(accountController))
);

// Delete account
router.delete(
  '/:id',
  requireWriteAccess,
  validate({ params: idParamSchema }),
  asyncHandler(accountController.delete.bind(accountController))
);

// Import default chart
router.post(
  '/import-template',
  requireWriteAccess,
  validate({
    body: z.object({
      template: z.enum(['service']).default('service'),
    }),
  }),
  asyncHandler(accountController.importTemplate.bind(accountController))
);

export default router;
