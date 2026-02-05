import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Mail, Phone, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiGet } from '@/api/client';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: customerData, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => apiGet<any>(`/customers/${id}`),
  });

  const { data: transactionsData } = useQuery({
    queryKey: ['customerTransactions', id],
    queryFn: () => apiGet<any>(`/customers/${id}/transactions`),
  });

  const customer = customerData?.data;
  const transactions = transactionsData?.data;

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (!customer) {
    return <div className="text-center py-8">Customer not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/customers">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{customer.name}</h1>
          <p className="text-muted-foreground">{customer.code}</p>
        </div>
        <Link to={`/invoices/new?customerId=${customer.id}`}>
          <Button>
            <FileText className="w-4 h-4 mr-2" />
            Create Invoice
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Customer Info */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {customer.email && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <a href={`mailto:${customer.email}`} className="text-primary hover:underline">
                  {customer.email}
                </a>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{customer.phone}</span>
              </div>
            )}
            {customer.billingAddress && (
              <div className="pt-2">
                <p className="text-sm font-medium mb-1">Billing Address</p>
                <p className="text-sm text-muted-foreground">
                  {customer.billingAddress.line1}<br />
                  {customer.billingAddress.city}, {customer.billingAddress.state} {customer.billingAddress.postalCode}
                </p>
              </div>
            )}
            <div className="pt-2">
              <p className="text-sm font-medium mb-1">Payment Terms</p>
              <p className="text-sm text-muted-foreground">Net {customer.paymentTerms} days</p>
            </div>
          </CardContent>
        </Card>

        {/* Balance */}
        <Card>
          <CardHeader>
            <CardTitle>Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{formatCurrency(customer.balance)}</p>
            <p className="text-sm text-muted-foreground mt-1">Outstanding balance</p>
          </CardContent>
        </Card>

        {/* Credit Limit */}
        <Card>
          <CardHeader>
            <CardTitle>Credit</CardTitle>
          </CardHeader>
          <CardContent>
            {customer.creditLimit ? (
              <>
                <p className="text-4xl font-bold">{formatCurrency(customer.creditLimit)}</p>
                <p className="text-sm text-muted-foreground mt-1">Credit limit</p>
              </>
            ) : (
              <p className="text-muted-foreground">No credit limit set</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Invoices</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {transactions?.invoices?.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 font-medium">Invoice</th>
                  <th className="text-left py-3 px-4 font-medium">Date</th>
                  <th className="text-left py-3 px-4 font-medium">Due Date</th>
                  <th className="text-right py-3 px-4 font-medium">Total</th>
                  <th className="text-right py-3 px-4 font-medium">Balance</th>
                  <th className="text-center py-3 px-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.invoices.map((invoice: any) => (
                  <tr key={invoice.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{invoice.invoiceNumber}</td>
                    <td className="py-3 px-4">{formatDate(invoice.date)}</td>
                    <td className="py-3 px-4">{formatDate(invoice.dueDate)}</td>
                    <td className="py-3 px-4 text-right font-mono">{formatCurrency(invoice.total)}</td>
                    <td className="py-3 px-4 text-right font-mono">{formatCurrency(invoice.amountDue)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={cn(
                        'px-2 py-1 rounded text-xs',
                        invoice.status === 'PAID' && 'bg-green-100 text-green-800',
                        invoice.status === 'SENT' && 'bg-blue-100 text-blue-800',
                        invoice.status === 'OVERDUE' && 'bg-red-100 text-red-800',
                        invoice.status === 'DRAFT' && 'bg-gray-100 text-gray-800',
                        invoice.status === 'PARTIAL' && 'bg-yellow-100 text-yellow-800'
                      )}>
                        {invoice.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-6 text-center text-muted-foreground">No invoices yet</p>
          )}
        </CardContent>
      </Card>

      {/* Payments */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Payments</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {transactions?.payments?.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 font-medium">Payment #</th>
                  <th className="text-left py-3 px-4 font-medium">Date</th>
                  <th className="text-left py-3 px-4 font-medium">Method</th>
                  <th className="text-right py-3 px-4 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.payments.map((payment: any) => (
                  <tr key={payment.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{payment.paymentNumber}</td>
                    <td className="py-3 px-4">{formatDate(payment.date)}</td>
                    <td className="py-3 px-4">{payment.method}</td>
                    <td className="py-3 px-4 text-right font-mono text-green-600">
                      {formatCurrency(payment.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-6 text-center text-muted-foreground">No payments yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
