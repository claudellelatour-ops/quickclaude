import { Response } from 'express';
import { reportService } from './report.service';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess } from '../../utils/response';

export class ReportController {
  async profitAndLoss(req: AuthenticatedRequest, res: Response) {
    const { startDate, endDate, compareStartDate, compareEndDate } = req.query as any;

    const report = await reportService.getProfitAndLoss(
      req.companyId!,
      new Date(startDate),
      new Date(endDate),
      compareStartDate ? new Date(compareStartDate) : undefined,
      compareEndDate ? new Date(compareEndDate) : undefined
    );

    return sendSuccess(res, report);
  }

  async balanceSheet(req: AuthenticatedRequest, res: Response) {
    const { asOfDate, compareAsOfDate } = req.query as any;

    const report = await reportService.getBalanceSheet(
      req.companyId!,
      new Date(asOfDate),
      compareAsOfDate ? new Date(compareAsOfDate) : undefined
    );

    return sendSuccess(res, report);
  }

  async trialBalance(req: AuthenticatedRequest, res: Response) {
    const { asOfDate } = req.query as any;

    const report = await reportService.getTrialBalance(
      req.companyId!,
      new Date(asOfDate)
    );

    return sendSuccess(res, report);
  }

  async arAging(req: AuthenticatedRequest, res: Response) {
    const { asOfDate, agingPeriods } = req.query as any;

    const periods = agingPeriods
      ? agingPeriods.split(',').map(Number)
      : [30, 60, 90, 120];

    const report = await reportService.getARAgingReport(
      req.companyId!,
      new Date(asOfDate),
      periods
    );

    return sendSuccess(res, report);
  }

  async apAging(req: AuthenticatedRequest, res: Response) {
    const { asOfDate, agingPeriods } = req.query as any;

    const periods = agingPeriods
      ? agingPeriods.split(',').map(Number)
      : [30, 60, 90, 120];

    const report = await reportService.getAPAgingReport(
      req.companyId!,
      new Date(asOfDate),
      periods
    );

    return sendSuccess(res, report);
  }

  async generalLedger(req: AuthenticatedRequest, res: Response) {
    const { startDate, endDate, accountId } = req.query as any;

    const report = await reportService.getGeneralLedger(
      req.companyId!,
      new Date(startDate),
      new Date(endDate),
      accountId
    );

    return sendSuccess(res, report);
  }
}

export const reportController = new ReportController();
