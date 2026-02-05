import { Router } from 'express';
import { billPaymentController } from './billPayment.controller';
import { validate, idParamSchema } from '../../middleware/validate';
import { authenticate, requireCompany, requireWriteAccess } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  createBillPaymentSchema,
  billPaymentQuerySchema,
} from './billPayment.schema';

const router = Router();

router.use(authenticate, requireCompany);

router.get(
  '/',
  validate({ query: billPaymentQuerySchema }),
  asyncHandler(billPaymentController.list.bind(billPaymentController))
);

router.get(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(billPaymentController.get.bind(billPaymentController))
);

router.post(
  '/',
  requireWriteAccess,
  validate({ body: createBillPaymentSchema }),
  asyncHandler(billPaymentController.create.bind(billPaymentController))
);

router.delete(
  '/:id',
  requireWriteAccess,
  validate({ params: idParamSchema }),
  asyncHandler(billPaymentController.delete.bind(billPaymentController))
);

export default router;
