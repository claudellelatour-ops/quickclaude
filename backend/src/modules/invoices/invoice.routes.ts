import { Router } from 'express';
import { invoiceController } from './invoice.controller';
import { validate, idParamSchema } from '../../middleware/validate';
import { authenticate, requireCompany, requireWriteAccess } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  invoiceQuerySchema,
} from './invoice.schema';

const router = Router();

router.use(authenticate, requireCompany);

router.get(
  '/',
  validate({ query: invoiceQuerySchema }),
  asyncHandler(invoiceController.list.bind(invoiceController))
);

router.get(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(invoiceController.get.bind(invoiceController))
);

router.post(
  '/',
  requireWriteAccess,
  validate({ body: createInvoiceSchema }),
  asyncHandler(invoiceController.create.bind(invoiceController))
);

router.put(
  '/:id',
  requireWriteAccess,
  validate({ params: idParamSchema, body: updateInvoiceSchema }),
  asyncHandler(invoiceController.update.bind(invoiceController))
);

router.post(
  '/:id/send',
  requireWriteAccess,
  validate({ params: idParamSchema }),
  asyncHandler(invoiceController.send.bind(invoiceController))
);

router.post(
  '/:id/void',
  requireWriteAccess,
  validate({ params: idParamSchema }),
  asyncHandler(invoiceController.void.bind(invoiceController))
);

export default router;
