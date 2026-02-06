import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiGet } from '@/api/client';
import { formatCurrency, cn } from '@/lib/utils';

type ReportType = 'profit-loss' | 'balance-sheet' | 'trial-balance' | 'ar-aging' | 'ap-aging';

const reports = [
  { id: 'profit-loss', name: 'Profit & Loss', description: 'Revenue and expenses for a period' },
  { id: 'balance-sheet', name: 'Balance Sheet', description: 'Assets, liabilities, and equity' },
  { id: 'trial-balance', name: 'Trial Balance', description: 'All account balances' },
  { id: 'ar-aging', name: 'AR Aging', description: 'Outstanding customer invoices' },
  { id: 'ap-aging', name: 'AP Aging', description: 'Outstanding vendor bills' },
];

export function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Financial reports and analysis</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Report Selection */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Select Report</h2>
          {reports.map((report) => (
            <Card
              key={report.id}
              className={cn(
                'cursor-pointer transition-colors',
                selectedReport === report.id ? 'ring-2 ring-primary' : 'hover:bg-accent/50'
              )}
              onClick={() => setSelectedReport(report.id as ReportType)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <FileText className="w-8 h-8 text-primary" />
                <div>
                  <h3 className="font-medium">{report.name}</h3>
                  <p className="text-sm text-muted-foreground">{report.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Report Content */}
        <div className="col-span-2">
          {selectedReport ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{reports.find((r) => r.id === selectedReport)?.name}</CardTitle>
                <div className="flex items-center gap-4">
                  {['profit-loss', 'trial-balance'].includes(selectedReport) ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">From</Label>
                        <Input
                          type="date"
                          value={dateRange.startDate}
                          onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                          className="w-36"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">To</Label>
                        <Input
                          type="date"
                          value={dateRange.endDate}
                          onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                          className="w-36"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">As of</Label>
                      <Input
                        type="date"
                        value={asOfDate}
                        onChange={(e) => setAsOfDate(e.target.value)}
                        className="w-36"
                      />
                    </div>
                  )}
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {selectedReport === 'profit-loss' && (
                  <ProfitLossReport startDate={dateRange.startDate} endDate={dateRange.endDate} />
                )}
                {selectedReport === 'balance-sheet' && (
                  <BalanceSheetReport asOfDate={asOfDate} />
                )}
                {selectedReport === 'trial-balance' && (
                  <TrialBalanceReport asOfDate={asOfDate} />
                )}
                {selectedReport === 'ar-aging' && (
                  <ARAgingReport asOfDate={asOfDate} />
                )}
                {selectedReport === 'ap-aging' && (
                  <APAgingReport asOfDate={asOfDate} />
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Select a report from the list to view it
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfitLossReport({ startDate, endDate }: { startDate: string; endDate: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report', 'profit-loss', startDate, endDate],
    queryFn: () => apiGet<any>('/reports/profit-loss', {
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
    }),
  });

  if (isLoading) return <div className="text-center py-8">Loading...</div>;

  const report = data?.data;
  if (!report) return <div className="text-center py-8">No data</div>;

  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-semibold text-green-700 mb-2">Revenue</h3>
        <table className="w-full">
          <tbody>
            {report.revenue.accounts.map((acc: any) => (
              <tr key={acc.id} className="border-b">
                <td className="py-2">{acc.code} - {acc.name}</td>
                <td className="py-2 text-right font-mono">{formatCurrency(acc.balance)}</td>
              </tr>
            ))}
            <tr className="font-semibold bg-green-50">
              <td className="py-2">Total Revenue</td>
              <td className="py-2 text-right font-mono">{formatCurrency(report.revenue.total)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h3 className="font-semibold text-red-700 mb-2">Expenses</h3>
        <table className="w-full">
          <tbody>
            {report.expenses.accounts.map((acc: any) => (
              <tr key={acc.id} className="border-b">
                <td className="py-2">{acc.code} - {acc.name}</td>
                <td className="py-2 text-right font-mono">{formatCurrency(acc.balance)}</td>
              </tr>
            ))}
            <tr className="font-semibold bg-red-50">
              <td className="py-2">Total Expenses</td>
              <td className="py-2 text-right font-mono">{formatCurrency(report.expenses.total)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <div className={cn(
        'p-4 rounded-lg font-bold text-lg flex justify-between',
        report.netIncome >= 0 ? 'bg-green-100' : 'bg-red-100'
      )}>
        <span>Net Income</span>
        <span className="font-mono">{formatCurrency(report.netIncome)}</span>
      </div>
    </div>
  );
}

function BalanceSheetReport({ asOfDate }: { asOfDate: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report', 'balance-sheet', asOfDate],
    queryFn: () => apiGet<any>('/reports/balance-sheet', {
      asOfDate: new Date(asOfDate).toISOString(),
    }),
  });

  if (isLoading) return <div className="text-center py-8">Loading...</div>;

  const report = data?.data;
  if (!report) return <div className="text-center py-8">No data</div>;

  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-semibold text-blue-700 mb-2">Assets</h3>
        <table className="w-full">
          <tbody>
            {report.assets.accounts.map((acc: any) => (
              <tr key={acc.id} className="border-b">
                <td className="py-2">{acc.code} - {acc.name}</td>
                <td className="py-2 text-right font-mono">{formatCurrency(acc.balance)}</td>
              </tr>
            ))}
            <tr className="font-semibold bg-blue-50">
              <td className="py-2">Total Assets</td>
              <td className="py-2 text-right font-mono">{formatCurrency(report.assets.total)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h3 className="font-semibold text-red-700 mb-2">Liabilities</h3>
        <table className="w-full">
          <tbody>
            {report.liabilities.accounts.map((acc: any) => (
              <tr key={acc.id} className="border-b">
                <td className="py-2">{acc.code} - {acc.name}</td>
                <td className="py-2 text-right font-mono">{formatCurrency(acc.balance)}</td>
              </tr>
            ))}
            <tr className="font-semibold bg-red-50">
              <td className="py-2">Total Liabilities</td>
              <td className="py-2 text-right font-mono">{formatCurrency(report.liabilities.total)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h3 className="font-semibold text-purple-700 mb-2">Equity</h3>
        <table className="w-full">
          <tbody>
            {report.equity.accounts.map((acc: any) => (
              <tr key={acc.id} className="border-b">
                <td className="py-2">{acc.code} - {acc.name}</td>
                <td className="py-2 text-right font-mono">{formatCurrency(acc.balance)}</td>
              </tr>
            ))}
            <tr className="border-b">
              <td className="py-2">Retained Earnings</td>
              <td className="py-2 text-right font-mono">{formatCurrency(report.equity.retainedEarnings)}</td>
            </tr>
            <tr className="font-semibold bg-purple-50">
              <td className="py-2">Total Equity</td>
              <td className="py-2 text-right font-mono">{formatCurrency(report.equity.total)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <div className="p-4 rounded-lg bg-gray-100 font-bold text-lg flex justify-between">
        <span>Total Liabilities & Equity</span>
        <span className="font-mono">{formatCurrency(report.totalLiabilitiesAndEquity)}</span>
      </div>
    </div>
  );
}

function TrialBalanceReport({ asOfDate }: { asOfDate: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report', 'trial-balance', asOfDate],
    queryFn: () => apiGet<any>('/reports/trial-balance', {
      asOfDate: new Date(asOfDate).toISOString(),
    }),
  });

  if (isLoading) return <div className="text-center py-8">Loading...</div>;

  const report = data?.data;
  if (!report) return <div className="text-center py-8">No data</div>;

  return (
    <div>
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left py-2 px-4 font-medium">Account</th>
            <th className="text-right py-2 px-4 font-medium">Debit</th>
            <th className="text-right py-2 px-4 font-medium">Credit</th>
          </tr>
        </thead>
        <tbody>
          {report.accounts.map((acc: any) => (
            <tr key={acc.id} className="border-b">
              <td className="py-2 px-4">{acc.code} - {acc.name}</td>
              <td className="py-2 px-4 text-right font-mono">
                {acc.debit > 0 ? formatCurrency(acc.debit) : ''}
              </td>
              <td className="py-2 px-4 text-right font-mono">
                {acc.credit > 0 ? formatCurrency(acc.credit) : ''}
              </td>
            </tr>
          ))}
          <tr className="font-bold bg-gray-100">
            <td className="py-2 px-4">Total</td>
            <td className="py-2 px-4 text-right font-mono">{formatCurrency(report.totalDebits)}</td>
            <td className="py-2 px-4 text-right font-mono">{formatCurrency(report.totalCredits)}</td>
          </tr>
        </tbody>
      </table>
      <div className={cn(
        'mt-4 p-3 rounded text-center',
        report.isBalanced ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      )}>
        {report.isBalanced ? 'Trial balance is balanced' : 'Trial balance is out of balance!'}
      </div>
    </div>
  );
}

function ARAgingReport({ asOfDate }: { asOfDate: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report', 'ar-aging', asOfDate],
    queryFn: () => apiGet<any>('/reports/ar-aging', {
      asOfDate: new Date(asOfDate).toISOString(),
    }),
  });

  if (isLoading) return <div className="text-center py-8">Loading...</div>;

  const report = data?.data;
  if (!report) return <div className="text-center py-8">No data</div>;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-5 gap-4">
        {report.summary.buckets.map((bucket: any) => (
          <Card key={bucket.period}>
            <CardContent className="pt-4 text-center">
              <p className="text-sm text-muted-foreground">{bucket.period}</p>
              <p className="text-xl font-bold">{formatCurrency(bucket.amount)}</p>
              <p className="text-xs text-muted-foreground">{bucket.count} invoices</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* By Customer */}
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left py-2 px-4 font-medium">Customer</th>
            {report.summary.buckets.map((b: any) => (
              <th key={b.period} className="text-right py-2 px-4 font-medium">{b.period}</th>
            ))}
            <th className="text-right py-2 px-4 font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {report.byCustomer.map((customer: any) => (
            <tr key={customer.name} className="border-b">
              <td className="py-2 px-4 font-medium">{customer.name}</td>
              {customer.buckets.map((amount: number, i: number) => (
                <td key={i} className="py-2 px-4 text-right font-mono">
                  {amount > 0 ? formatCurrency(amount) : '-'}
                </td>
              ))}
              <td className="py-2 px-4 text-right font-mono font-semibold">
                {formatCurrency(customer.total)}
              </td>
            </tr>
          ))}
          <tr className="font-bold bg-gray-100">
            <td className="py-2 px-4">Total</td>
            {report.summary.buckets.map((b: any) => (
              <td key={b.period} className="py-2 px-4 text-right font-mono">
                {formatCurrency(b.amount)}
              </td>
            ))}
            <td className="py-2 px-4 text-right font-mono">{formatCurrency(report.summary.total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function APAgingReport({ asOfDate }: { asOfDate: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report', 'ap-aging', asOfDate],
    queryFn: () => apiGet<any>('/reports/ap-aging', {
      asOfDate: new Date(asOfDate).toISOString(),
    }),
  });

  if (isLoading) return <div className="text-center py-8">Loading...</div>;

  const report = data?.data;
  if (!report) return <div className="text-center py-8">No data</div>;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-5 gap-4">
        {report.summary.buckets.map((bucket: any) => (
          <Card key={bucket.period}>
            <CardContent className="pt-4 text-center">
              <p className="text-sm text-muted-foreground">{bucket.period}</p>
              <p className="text-xl font-bold">{formatCurrency(bucket.amount)}</p>
              <p className="text-xs text-muted-foreground">{bucket.count} bills</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* By Vendor */}
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left py-2 px-4 font-medium">Vendor</th>
            {report.summary.buckets.map((b: any) => (
              <th key={b.period} className="text-right py-2 px-4 font-medium">{b.period}</th>
            ))}
            <th className="text-right py-2 px-4 font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {report.byVendor.map((vendor: any) => (
            <tr key={vendor.name} className="border-b">
              <td className="py-2 px-4 font-medium">{vendor.name}</td>
              {vendor.buckets.map((amount: number, i: number) => (
                <td key={i} className="py-2 px-4 text-right font-mono">
                  {amount > 0 ? formatCurrency(amount) : '-'}
                </td>
              ))}
              <td className="py-2 px-4 text-right font-mono font-semibold">
                {formatCurrency(vendor.total)}
              </td>
            </tr>
          ))}
          <tr className="font-bold bg-gray-100">
            <td className="py-2 px-4">Total</td>
            {report.summary.buckets.map((b: any) => (
              <td key={b.period} className="py-2 px-4 text-right font-mono">
                {formatCurrency(b.amount)}
              </td>
            ))}
            <td className="py-2 px-4 text-right font-mono">{formatCurrency(report.summary.total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
