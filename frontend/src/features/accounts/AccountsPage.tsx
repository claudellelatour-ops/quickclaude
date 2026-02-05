import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ChevronRight, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiGet, apiPost } from '@/api/client';
import { formatCurrency, cn } from '@/lib/utils';

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  subType: string;
  balance: number;
  isSystemAccount: boolean;
  isActive: boolean;
  children?: Account[];
}

const accountTypeColors: Record<string, string> = {
  ASSET: 'bg-blue-100 text-blue-800',
  LIABILITY: 'bg-red-100 text-red-800',
  EQUITY: 'bg-purple-100 text-purple-800',
  REVENUE: 'bg-green-100 text-green-800',
  EXPENSE: 'bg-orange-100 text-orange-800',
};

function AccountRow({ account, level = 0 }: { account: Account; level?: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = account.children && account.children.length > 0;

  return (
    <>
      <tr className="border-b hover:bg-gray-50">
        <td className="py-3 px-4">
          <div className="flex items-center" style={{ paddingLeft: `${level * 20}px` }}>
            {hasChildren ? (
              <button
                onClick={() => setExpanded(!expanded)}
                className="mr-2 p-1 hover:bg-gray-200 rounded"
              >
                {expanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            ) : (
              <span className="w-6 mr-2" />
            )}
            <span className="font-mono text-sm text-muted-foreground mr-3">
              {account.code}
            </span>
            <span className={cn(account.isSystemAccount && 'font-medium')}>
              {account.name}
            </span>
          </div>
        </td>
        <td className="py-3 px-4">
          <span className={cn('px-2 py-1 rounded text-xs font-medium', accountTypeColors[account.type])}>
            {account.type}
          </span>
        </td>
        <td className="py-3 px-4 text-right font-mono">
          {formatCurrency(account.balance)}
        </td>
        <td className="py-3 px-4 text-center">
          <span className={cn(
            'px-2 py-1 rounded text-xs',
            account.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          )}>
            {account.isActive ? 'Active' : 'Inactive'}
          </span>
        </td>
      </tr>
      {expanded && hasChildren && account.children!.map((child) => (
        <AccountRow key={child.id} account={child} level={level + 1} />
      ))}
    </>
  );
}

export function AccountsPage() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAccount, setNewAccount] = useState({
    code: '',
    name: '',
    type: 'EXPENSE',
    subType: 'EXPENSE',
  });

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiGet<Account[]>('/accounts'),
  });

  const createAccount = useMutation({
    mutationFn: (account: typeof newAccount) => apiPost('/accounts', account),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setShowAddForm(false);
      setNewAccount({ code: '', name: '', type: 'EXPENSE', subType: 'EXPENSE' });
    },
  });

  const accounts = data?.data || [];

  // Group by type
  const groupedAccounts = accounts.reduce((acc, account) => {
    if (!acc[account.type]) {
      acc[account.type] = [];
    }
    acc[account.type].push(account);
    return acc;
  }, {} as Record<string, Account[]>);

  const typeOrder = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Chart of Accounts</h1>
          <p className="text-muted-foreground">Manage your account structure</p>
        </div>
        <Button onClick={() => setShowAddForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Account
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>New Account</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createAccount.mutate(newAccount);
              }}
              className="grid grid-cols-4 gap-4"
            >
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={newAccount.code}
                  onChange={(e) => setNewAccount({ ...newAccount, code: e.target.value })}
                  placeholder="8000"
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={newAccount.name}
                  onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                  placeholder="New Account"
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <select
                  value={newAccount.type}
                  onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="ASSET">Asset</option>
                  <option value="LIABILITY">Liability</option>
                  <option value="EQUITY">Equity</option>
                  <option value="REVENUE">Revenue</option>
                  <option value="EXPENSE">Expense</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" disabled={createAccount.isPending}>
                  {createAccount.isPending ? 'Creating...' : 'Create'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-8">Loading accounts...</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 font-medium">Account</th>
                  <th className="text-left py-3 px-4 font-medium">Type</th>
                  <th className="text-right py-3 px-4 font-medium">Balance</th>
                  <th className="text-center py-3 px-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {typeOrder.map((type) => (
                  groupedAccounts[type]?.map((account) => (
                    <AccountRow key={account.id} account={account} />
                  ))
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
