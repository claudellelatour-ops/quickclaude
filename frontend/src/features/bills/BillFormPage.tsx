import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiGet, apiPost, apiPut } from '@/api/client';
import { formatCurrency } from '@/lib/utils';

interface BillLine {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  accountId: string;
}

export function BillFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const [vendorId, setVendorId] = useState('');
  const [vendorRef, setVendorRef] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [terms, setTerms] = useState(30);
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState<BillLine[]>([
    { description: '', quantity: 1, unitPrice: 0, accountId: '' },
  ]);

  const { data: vendorsData } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => apiGet<any>('/vendors', { limit: 100 }),
  });

  const { data: accountsData } = useQuery({
    queryKey: ['accounts', 'expense'],
    queryFn: () => apiGet<any>('/accounts', { type: 'EXPENSE', flat: true }),
  });

  const { data: billData } = useQuery({
    queryKey: ['bill', id],
    queryFn: () => apiGet<any>(`/bills/${id}`),
    enabled: isEdit,
  });

  useEffect(() => {
    if (billData?.data) {
      const bill = billData.data;
      setVendorId(bill.vendorId);
      setVendorRef(bill.vendorRef || '');
      setBillDate(bill.date.split('T')[0]);
      setTerms(bill.terms);
      setMemo(bill.memo || '');
      setLines(bill.lines.map((line: any) => ({
        id: line.id,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        accountId: line.accountId,
      })));
    }
  }, [billData]);

  const vendors = (vendorsData?.data as any)?.vendors || vendorsData?.data || [];
  const accounts = accountsData?.data || [];

  const createBill = useMutation({
    mutationFn: (data: any) => isEdit ? apiPut(`/bills/${id}`, data) : apiPost('/bills', data),
    onSuccess: () => navigate('/bills'),
  });

  const addLine = () => {
    setLines([...lines, { description: '', quantity: 1, unitPrice: 0, accountId: '' }]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const updateLine = (index: number, field: keyof BillLine, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const total = lines.reduce((sum, line) => sum + (line.quantity * line.unitPrice), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const dueDate = new Date(billDate);
    dueDate.setDate(dueDate.getDate() + terms);

    createBill.mutate({
      vendorId,
      vendorRef: vendorRef || undefined,
      date: new Date(billDate).toISOString(),
      dueDate: dueDate.toISOString(),
      terms,
      memo,
      lines: lines.filter(l => l.description && l.accountId).map(line => ({
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        accountId: line.accountId,
      })),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/bills')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-3xl font-bold">{isEdit ? 'Edit Bill' : 'Enter Bill'}</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Bill Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Vendor *</Label>
                    <select
                      value={vendorId}
                      onChange={(e) => setVendorId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      required
                    >
                      <option value="">Select vendor...</option>
                      {vendors.map((vendor: any) => (
                        <option key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Vendor Reference #</Label>
                    <Input
                      value={vendorRef}
                      onChange={(e) => setVendorRef(e.target.value)}
                      placeholder="Invoice #, PO #, etc."
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Bill Date</Label>
                    <Input
                      type="date"
                      value={billDate}
                      onChange={(e) => setBillDate(e.target.value)}
                    />
                  </div>
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
                <CardTitle>Expense Lines</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Line
                </Button>
              </CardHeader>
              <CardContent>
                <table className="w-full">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2 text-sm font-medium w-40">Account</th>
                      <th className="text-left py-2 text-sm font-medium">Description</th>
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
                            value={line.description}
                            onChange={(e) => updateLine(index, 'description', e.target.value)}
                            placeholder="Description"
                          />
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
                          {formatCurrency(line.quantity * line.unitPrice)}
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
              <CardContent>
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="font-mono">{formatCurrency(total)}</span>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={createBill.isPending} className="w-full">
                {createBill.isPending ? 'Saving...' : (isEdit ? 'Update Bill' : 'Save Bill')}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/bills')}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
