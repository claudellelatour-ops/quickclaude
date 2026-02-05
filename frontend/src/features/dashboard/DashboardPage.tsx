import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiGet } from '@/api/client';
import { formatCurrency } from '@/lib/utils';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  Receipt,
  AlertCircle,
} from 'lucide-react';

export function DashboardPage() {
  const { data: arAging } = useQuery({
    queryKey: ['arAging'],
    queryFn: () => apiGet('/reports/ar-aging', { asOfDate: new Date().toISOString() }),
  });

  const { data: apAging } = useQuery({
    queryKey: ['apAging'],
    queryFn: () => apiGet('/reports/ap-aging', { asOfDate: new Date().toISOString() }),
  });

  const arTotal = (arAging?.data as any)?.summary?.total || 0;
  const apTotal = (apAging?.data as any)?.summary?.total || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your business overview.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accounts Receivable</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(arTotal)}</div>
            <p className="text-xs text-muted-foreground">Outstanding invoices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accounts Payable</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(apTotal)}</div>
            <p className="text-xs text-muted-foreground">Outstanding bills</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Position</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(arTotal - apTotal)}</div>
            <p className="text-xs text-muted-foreground">AR - AP</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Items</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((arAging?.data as any)?.details?.filter((d: any) => d.daysOverdue > 0).length || 0) +
                ((apAging?.data as any)?.details?.filter((d: any) => d.daysOverdue > 0).length || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:bg-accent/50 cursor-pointer transition-colors">
          <CardContent className="flex items-center p-6">
            <FileText className="h-8 w-8 text-primary mr-4" />
            <div>
              <h3 className="font-semibold">Create Invoice</h3>
              <p className="text-sm text-muted-foreground">Bill a customer</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:bg-accent/50 cursor-pointer transition-colors">
          <CardContent className="flex items-center p-6">
            <Receipt className="h-8 w-8 text-primary mr-4" />
            <div>
              <h3 className="font-semibold">Enter Bill</h3>
              <p className="text-sm text-muted-foreground">Record an expense</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:bg-accent/50 cursor-pointer transition-colors">
          <CardContent className="flex items-center p-6">
            <DollarSign className="h-8 w-8 text-primary mr-4" />
            <div>
              <h3 className="font-semibold">Receive Payment</h3>
              <p className="text-sm text-muted-foreground">Record a payment</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:bg-accent/50 cursor-pointer transition-colors">
          <CardContent className="flex items-center p-6">
            <Users className="h-8 w-8 text-primary mr-4" />
            <div>
              <h3 className="font-semibold">Add Customer</h3>
              <p className="text-sm text-muted-foreground">New customer record</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Create invoices to see them here.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Bills</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Enter bills to see them here.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
