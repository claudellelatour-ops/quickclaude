import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Upload, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiGet, apiPost } from '@/api/client';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountType: string;
  currentBalance: number;
  lastReconciled: string | null;
  account: {
    id: string;
    code: string;
    name: string;
  };
}

interface BankTransaction {
  id: string;
  transactionDate: string;
  description: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  status: string;
  categoryAccount?: {
    id: string;
    code: string;
    name: string;
  };
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  MATCHED: 'bg-blue-100 text-blue-800',
  CATEGORIZED: 'bg-green-100 text-green-800',
  RECONCILED: 'bg-gray-100 text-gray-800',
};

export function BankingPage() {
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const queryClient = useQueryClient();

  const { data: accountsData, isLoading: loadingAccounts } = useQuery({
    queryKey: ['bankAccounts'],
    queryFn: () => apiGet<BankAccount[]>('/bank-accounts'),
  });

  const { data: transactionsData, isLoading: loadingTransactions } = useQuery({
    queryKey: ['bankTransactions', selectedAccount],
    queryFn: () => apiGet<{ transactions: BankTransaction[] }>(
      `/bank-accounts/${selectedAccount}/transactions`,
      { limit: 100 }
    ),
    enabled: !!selectedAccount,
  });

  const { data: glAccountsData } = useQuery({
    queryKey: ['accounts', 'bank'],
    queryFn: () => apiGet<any>('/accounts', { subType: 'BANK', flat: true }),
  });

  const bankAccounts = accountsData?.data || [];
  const transactions = (transactionsData?.data as any)?.transactions || [];
  const glAccounts = glAccountsData?.data || [];

  // Auto-select first account
  if (bankAccounts.length > 0 && !selectedAccount) {
    setSelectedAccount(bankAccounts[0].id);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Banking</h1>
          <p className="text-muted-foreground">Manage bank accounts and transactions</p>
        </div>
        <Button onClick={() => setShowAddForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Bank Account
        </Button>
      </div>

      {/* Bank Accounts */}
      <div className="grid grid-cols-4 gap-4">
        {loadingAccounts ? (
          <div className="col-span-4 text-center py-4">Loading accounts...</div>
        ) : bankAccounts.length === 0 ? (
          <Card className="col-span-4">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No bank accounts set up</p>
              <Button className="mt-4" onClick={() => setShowAddForm(true)}>
                Add Your First Bank Account
              </Button>
            </CardContent>
          </Card>
        ) : (
          bankAccounts.map((account: BankAccount) => (
            <Card
              key={account.id}
              className={cn(
                'cursor-pointer transition-colors',
                selectedAccount === account.id ? 'ring-2 ring-primary' : 'hover:bg-accent/50'
              )}
              onClick={() => setSelectedAccount(account.id)}
            >
              <CardContent className="pt-6">
                <h3 className="font-semibold">{account.bankName}</h3>
                <p className="text-sm text-muted-foreground">{account.account.name}</p>
                <p className="text-sm text-muted-foreground">****{account.accountNumber}</p>
                <p className="text-2xl font-bold mt-2">{formatCurrency(account.currentBalance)}</p>
                {account.lastReconciled && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Last reconciled: {formatDate(account.lastReconciled)}
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add Account Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add Bank Account</CardTitle>
          </CardHeader>
          <CardContent>
            <AddBankAccountForm
              glAccounts={glAccounts}
              onSuccess={() => {
                setShowAddForm(false);
                queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
              }}
              onCancel={() => setShowAddForm(false)}
            />
          </CardContent>
        </Card>
      )}

      {/* Transactions */}
      {selectedAccount && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Transactions</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>
              <Button variant="outline" size="sm">
                Reconcile
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingTransactions ? (
              <div className="text-center py-8">Loading transactions...</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No transactions. Import bank statements to get started.
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium">Date</th>
                    <th className="text-left py-3 px-4 font-medium">Description</th>
                    <th className="text-left py-3 px-4 font-medium">Category</th>
                    <th className="text-right py-3 px-4 font-medium">Amount</th>
                    <th className="text-center py-3 px-4 font-medium">Status</th>
                    <th className="w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn: BankTransaction) => (
                    <tr key={txn.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{formatDate(txn.transactionDate)}</td>
                      <td className="py-3 px-4">{txn.description}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {txn.categoryAccount?.name || '-'}
                      </td>
                      <td className={cn(
                        'py-3 px-4 text-right font-mono',
                        txn.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'
                      )}>
                        {txn.type === 'CREDIT' ? '+' : '-'}{formatCurrency(txn.amount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={cn('px-2 py-1 rounded text-xs', statusColors[txn.status])}>
                          {txn.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {txn.status === 'PENDING' && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" title="Categorize">
                              <Check className="w-4 h-4 text-green-600" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Exclude">
                              <X className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AddBankAccountForm({
  glAccounts,
  onSuccess,
  onCancel,
}: {
  glAccounts: any[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    accountId: '',
    bankName: '',
    accountNumber: '',
    routingNumber: '',
    accountType: 'CHECKING',
  });

  const createAccount = useMutation({
    mutationFn: (data: typeof form) => apiPost('/bank-accounts', data),
    onSuccess,
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        createAccount.mutate(form);
      }}
      className="grid grid-cols-3 gap-4"
    >
      <div className="space-y-2">
        <Label>GL Account *</Label>
        <select
          value={form.accountId}
          onChange={(e) => setForm({ ...form, accountId: e.target.value })}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          required
        >
          <option value="">Select GL account...</option>
          {glAccounts.map((account: any) => (
            <option key={account.id} value={account.id}>
              {account.code} - {account.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label>Bank Name *</Label>
        <Input
          value={form.bankName}
          onChange={(e) => setForm({ ...form, bankName: e.target.value })}
          placeholder="Chase, Bank of America, etc."
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Account Number *</Label>
        <Input
          value={form.accountNumber}
          onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
          placeholder="Last 4 digits shown"
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Routing Number</Label>
        <Input
          value={form.routingNumber}
          onChange={(e) => setForm({ ...form, routingNumber: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Account Type</Label>
        <select
          value={form.accountType}
          onChange={(e) => setForm({ ...form, accountType: e.target.value })}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="CHECKING">Checking</option>
          <option value="SAVINGS">Savings</option>
          <option value="CREDIT_CARD">Credit Card</option>
          <option value="MONEY_MARKET">Money Market</option>
        </select>
      </div>
      <div className="flex items-end gap-2">
        <Button type="submit" disabled={createAccount.isPending}>
          {createAccount.isPending ? 'Creating...' : 'Create'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
