import { Router } from 'express';
import { reportController } from './report.controller';
import { validate } from '../../middleware/validate';
import { authenticate, requireCompany } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  dateRangeSchema,
  asOfDateSchema,
  agingReportSchema,
  generalLedgerSchema,
} from './report.schema';

const router = Router();

router.use(authenticate, requireCompany);

router.get(
  '/profit-loss',
  validate({ query: dateRangeSchema }),
  asyncHandler(reportController.profitAndLoss.bind(reportController))
);

router.get(
  '/balance-sheet',
  validate({ query: asOfDateSchema }),
  asyncHandler(reportController.balanceSheet.bind(reportController))
);

router.get(
  '/trial-balance',
  validate({ query: asOfDateSchema }),
  asyncHandler(reportController.trialBalance.bind(reportController))
);

router.get(
  '/ar-aging',
  validate({ query: agingReportSchema }),
  asyncHandler(reportController.arAging.bind(reportController))
);

router.get(
  '/ap-aging',
  validate({ query: agingReportSchema }),
  asyncHandler(reportController.apAging.bind(reportController))
);

router.get(
  '/general-ledger',
  validate({ query: generalLedgerSchema }),
  asyncHandler(reportController.generalLedger.bind(reportController))
);

export default router;
