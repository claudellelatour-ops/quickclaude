import { Router } from 'express';
import { customerPaymentController } from './customerPayment.controller';
import { validate, idParamSchema } from '../../middleware/validate';
import { authenticate, requireCompany, requireWriteAccess } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  createCustomerPaymentSchema,
  customerPaymentQuerySchema,
} from './customerPayment.schema';

const router = Router();

router.use(authenticate, requireCompany);

router.get(
  '/',
  validate({ query: customerPaymentQuerySchema }),
  asyncHandler(customerPaymentController.list.bind(customerPaymentController))
);

router.get(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(customerPaymentController.get.bind(customerPaymentController))
);

router.post(
  '/',
  requireWriteAccess,
  validate({ body: createCustomerPaymentSchema }),
  asyncHandler(customerPaymentController.create.bind(customerPaymentController))
);

router.delete(
  '/:id',
  requireWriteAccess,
  validate({ params: idParamSchema }),
  asyncHandler(customerPaymentController.delete.bind(customerPaymentController))
);

export default router;
