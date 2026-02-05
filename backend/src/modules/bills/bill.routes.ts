import { Router } from 'express';
import { billController } from './bill.controller';
import { validate, idParamSchema } from '../../middleware/validate';
import { authenticate, requireCompany, requireWriteAccess } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  createBillSchema,
  updateBillSchema,
  billQuerySchema,
} from './bill.schema';

const router = Router();

router.use(authenticate, requireCompany);

router.get(
  '/',
  validate({ query: billQuerySchema }),
  asyncHandler(billController.list.bind(billController))
);

router.get(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(billController.get.bind(billController))
);

router.post(
  '/',
  requireWriteAccess,
  validate({ body: createBillSchema }),
  asyncHandler(billController.create.bind(billController))
);

router.put(
  '/:id',
  requireWriteAccess,
  validate({ params: idParamSchema, body: updateBillSchema }),
  asyncHandler(billController.update.bind(billController))
);

router.post(
  '/:id/void',
  requireWriteAccess,
  validate({ params: idParamSchema }),
  asyncHandler(billController.void.bind(billController))
);

export default router;
