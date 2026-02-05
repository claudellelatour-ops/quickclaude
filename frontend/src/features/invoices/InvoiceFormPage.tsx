import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiGet, apiPost, apiPut } from '@/api/client';
import { formatCurrency } from '@/lib/utils';

interface InvoiceLine {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  accountId: string;
  discountPercent: number;
}

export function InvoiceFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEdit = !!id;

  const [customerId, setCustomerId] = useState(searchParams.get('customerId') || '');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [terms, setTerms] = useState(30);
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState<InvoiceLine[]>([
    { description: '', quantity: 1, unitPrice: 0, accountId: '', discountPercent: 0 },
  ]);

  const { data: customersData } = useQuery({
    queryKey: ['customers'],
    queryFn: () => apiGet<any>('/customers', { limit: 100 }),
  });

  const { data: accountsData } = useQuery({
    queryKey: ['accounts', 'revenue'],
    queryFn: () => apiGet<any>('/accounts', { type: 'REVENUE', flat: true }),
  });

  const { data: invoiceData } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => apiGet<any>(`/invoices/${id}`),
    enabled: isEdit,
  });

  useEffect(() => {
    if (invoiceData?.data) {
      const invoice = invoiceData.data;
      setCustomerId(invoice.customerId);
      setInvoiceDate(invoice.date.split('T')[0]);
      setTerms(invoice.terms);
      setMemo(invoice.memo || '');
      setLines(invoice.lines.map((line: any) => ({
        id: line.id,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        accountId: line.accountId,
        discountPercent: line.discountPercent || 0,
      })));
    }
  }, [invoiceData]);

  const customers = (customersData?.data as any)?.customers || customersData?.data || [];
  const accounts = accountsData?.data || [];

  const createInvoice = useMutation({
    mutationFn: (data: any) => isEdit ? apiPut(`/invoices/${id}`, data) : apiPost('/invoices', data),
    onSuccess: () => navigate('/invoices'),
  });

  const addLine = () => {
    setLines([...lines, { description: '', quantity: 1, unitPrice: 0, accountId: '', discountPercent: 0 }]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const updateLine = (index: number, field: keyof InvoiceLine, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const calculateLineTotal = (line: InvoiceLine) => {
    const subtotal = line.quantity * line.unitPrice;
    const discount = subtotal * (line.discountPercent / 100);
    return subtotal - discount;
  };

  const subtotal = lines.reduce((sum, line) => sum + (line.quantity * line.unitPrice), 0);
  const discountTotal = lines.reduce((sum, line) => {
    return sum + (line.quantity * line.unitPrice * (line.discountPercent / 100));
  }, 0);
  const total = subtotal - discountTotal;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + terms);

    createInvoice.mutate({
      customerId,
      date: new Date(invoiceDate).toISOString(),
      dueDate: dueDate.toISOString(),
      terms,
      memo,
      lines: lines.filter(l => l.description && l.accountId).map(line => ({
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        accountId: line.accountId,
        discountPercent: line.discountPercent,
      })),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/invoices')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-3xl font-bold">{isEdit ? 'Edit Invoice' : 'New Invoice'}</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Invoice Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Customer *</Label>
                    <select
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      required
                    >
                      <option value="">Select customer...</option>
                      {customers.map((customer: any) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Invoice Date</Label>
                    <Input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Payment Terms (days)</Label>
                    <Input
                      type="number"
                      value={terms}
                      onChange={(e) => setTerms(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Memo</Label>
                    <Input
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                      placeholder="Internal notes..."
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Line Items</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Line
                </Button>
              </CardHeader>
              <CardContent>
                <table className="w-full">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2 text-sm font-medium">Description</th>
                      <th className="text-left py-2 text-sm font-medium w-32">Account</th>
                      <th className="text-right py-2 text-sm font-medium w-20">Qty</th>
                      <th className="text-right py-2 text-sm font-medium w-28">Price</th>
                      <th className="text-right py-2 text-sm font-medium w-24">Amount</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-2 pr-2">
                          <Input
                            value={line.description}
                            onChange={(e) => updateLine(index, 'description', e.target.value)}
                            placeholder="Description"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <select
                            value={line.accountId}
                            onChange={(e) => updateLine(index, 'accountId', e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                          >
                            <option value="">Account...</option>
                            {accounts.map((account: any) => (
                              <option key={account.id} value={account.id}>
                                {account.code} - {account.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 pr-2">
                          <Input
                            type="number"
                            value={line.quantity}
                            onChange={(e) => updateLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                            className="text-right"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={line.unitPrice}
                            onChange={(e) => updateLine(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="text-right"
                          />
                        </td>
                        <td className="py-2 pr-2 text-right font-mono">
                          {formatCurrency(calculateLineTotal(line))}
                        </td>
                        <td className="py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLine(index)}
                            disabled={lines.length === 1}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          {/* Summary Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono">{formatCurrency(subtotal)}</span>
                </div>
                {discountTotal > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span className="font-mono">-{formatCurrency(discountTotal)}</span>
                  </div>
                )}
                <div className="border-t pt-3 flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="font-mono">{formatCurrency(total)}</span>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={createInvoice.isPending} className="w-full">
                {createInvoice.isPending ? 'Saving...' : (isEdit ? 'Update Invoice' : 'Create Invoice')}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/invoices')}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
