import { Router } from 'express';
import { vendorController } from './vendor.controller';
import { validate, idParamSchema } from '../../middleware/validate';
import { authenticate, requireCompany, requireWriteAccess } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  createVendorSchema,
  updateVendorSchema,
  vendorQuerySchema,
} from './vendor.schema';

const router = Router();

router.use(authenticate, requireCompany);

router.get(
  '/',
  validate({ query: vendorQuerySchema }),
  asyncHandler(vendorController.list.bind(vendorController))
);

router.get(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(vendorController.get.bind(vendorController))
);

router.get(
  '/:id/transactions',
  validate({ params: idParamSchema }),
  asyncHandler(vendorController.getTransactions.bind(vendorController))
);

router.post(
  '/',
  requireWriteAccess,
  validate({ body: createVendorSchema }),
  asyncHandler(vendorController.create.bind(vendorController))
);

router.put(
  '/:id',
  requireWriteAccess,
  validate({ params: idParamSchema, body: updateVendorSchema }),
  asyncHandler(vendorController.update.bind(vendorController))
);

router.delete(
  '/:id',
  requireWriteAccess,
  validate({ params: idParamSchema }),
  asyncHandler(vendorController.delete.bind(vendorController))
);

export default router;
