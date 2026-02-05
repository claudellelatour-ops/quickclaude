import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiGet } from '@/api/client';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

interface Bill {
  id: string;
  billNumber: string;
  vendorRef: string | null;
  date: string;
  dueDate: string;
  total: number;
  amountDue: number;
  status: string;
  vendor: {
    id: string;
    name: string;
  };
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  RECEIVED: 'bg-blue-100 text-blue-800',
  PARTIAL: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-green-100 text-green-800',
  OVERDUE: 'bg-red-100 text-red-800',
  VOID: 'bg-gray-100 text-gray-500',
};

export function BillsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['bills', search, statusFilter],
    queryFn: () => apiGet<{ bills: Bill[] }>('/bills', {
      search,
      status: statusFilter || undefined,
      limit: 100,
    }),
  });

  const bills = (data?.data as any)?.bills || data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Bills</h1>
          <p className="text-muted-foreground">Manage your bills and expenses</p>
        </div>
        <Link to="/bills/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Enter Bill
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search bills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="RECEIVED">Received</option>
          <option value="PARTIAL">Partial</option>
          <option value="PAID">Paid</option>
          <option value="OVERDUE">Overdue</option>
        </select>
      </div>

      {/* Bill List */}
      {isLoading ? (
        <div className="text-center py-8">Loading bills...</div>
      ) : bills.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No bills found</p>
            <Link to="/bills/new">
              <Button className="mt-4">Enter Your First Bill</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 font-medium">Bill #</th>
                  <th className="text-left py-3 px-4 font-medium">Vendor</th>
                  <th className="text-left py-3 px-4 font-medium">Vendor Ref</th>
                  <th className="text-left py-3 px-4 font-medium">Date</th>
                  <th className="text-left py-3 px-4 font-medium">Due Date</th>
                  <th className="text-right py-3 px-4 font-medium">Total</th>
                  <th className="text-right py-3 px-4 font-medium">Balance</th>
                  <th className="text-center py-3 px-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((bill: Bill) => (
                  <tr key={bill.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <Link
                        to={`/bills/${bill.id}/edit`}
                        className="font-medium hover:text-primary"
                      >
                        {bill.billNumber}
                      </Link>
                    </td>
                    <td className="py-3 px-4">{bill.vendor.name}</td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {bill.vendorRef || '-'}
                    </td>
                    <td className="py-3 px-4">{formatDate(bill.date)}</td>
                    <td className="py-3 px-4">
                      <span className={cn(
                        new Date(bill.dueDate) < new Date() && bill.status !== 'PAID' && 'text-red-600'
                      )}>
                        {formatDate(bill.dueDate)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {formatCurrency(bill.total)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {formatCurrency(bill.amountDue)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={cn('px-2 py-1 rounded text-xs', statusColors[bill.status])}>
                        {bill.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
