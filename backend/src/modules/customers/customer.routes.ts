import { Router } from 'express';
import { customerController } from './customer.controller';
import { validate, idParamSchema } from '../../middleware/validate';
import { authenticate, requireCompany, requireWriteAccess } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  createCustomerSchema,
  updateCustomerSchema,
  customerQuerySchema,
} from './customer.schema';

const router = Router();

router.use(authenticate, requireCompany);

router.get(
  '/',
  validate({ query: customerQuerySchema }),
  asyncHandler(customerController.list.bind(customerController))
);

router.get(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(customerController.get.bind(customerController))
);

router.get(
  '/:id/transactions',
  validate({ params: idParamSchema }),
  asyncHandler(customerController.getTransactions.bind(customerController))
);

router.post(
  '/',
  requireWriteAccess,
  validate({ body: createCustomerSchema }),
  asyncHandler(customerController.create.bind(customerController))
);

router.put(
  '/:id',
  requireWriteAccess,
  validate({ params: idParamSchema, body: updateCustomerSchema }),
  asyncHandler(customerController.update.bind(customerController))
);

router.delete(
  '/:id',
  requireWriteAccess,
  validate({ params: idParamSchema }),
  asyncHandler(customerController.delete.bind(customerController))
);

export default router;
