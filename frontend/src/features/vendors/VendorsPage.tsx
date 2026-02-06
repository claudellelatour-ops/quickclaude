import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiGet, apiPost } from '@/api/client';
import { formatCurrency, cn } from '@/lib/utils';

interface Vendor {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  balance: number;
  is1099Eligible: boolean;
  isActive: boolean;
}

export function VendorsPage() {
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newVendor, setNewVendor] = useState({
    name: '',
    email: '',
    phone: '',
    is1099Eligible: false,
  });

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['vendors', search],
    queryFn: () => apiGet<{ vendors: Vendor[] }>('/vendors', { search, limit: 100 }),
  });

  const createVendor = useMutation({
    mutationFn: (vendor: typeof newVendor) => apiPost('/vendors', vendor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setShowAddForm(false);
      setNewVendor({ name: '', email: '', phone: '', is1099Eligible: false });
    },
  });

  const vendors = (data?.data as any)?.vendors || data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Vendors</h1>
          <p className="text-muted-foreground">Manage your vendor list</p>
        </div>
        <Button onClick={() => setShowAddForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Vendor
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search vendors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <Card>
          <CardContent className="pt-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createVendor.mutate(newVendor);
              }}
              className="grid grid-cols-5 gap-4"
            >
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={newVendor.name}
                  onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                  placeholder="Vendor Name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={newVendor.email}
                  onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={newVendor.phone}
                  onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label>1099 Eligible</Label>
                <div className="flex items-center h-10">
                  <input
                    type="checkbox"
                    checked={newVendor.is1099Eligible}
                    onChange={(e) => setNewVendor({ ...newVendor, is1099Eligible: e.target.checked })}
                    className="w-4 h-4"
                  />
                </div>
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" disabled={createVendor.isPending}>
                  {createVendor.isPending ? 'Creating...' : 'Create'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Vendor List */}
      {isLoading ? (
        <div className="text-center py-8">Loading vendors...</div>
      ) : vendors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No vendors found</p>
            <Button className="mt-4" onClick={() => setShowAddForm(true)}>
              Add Your First Vendor
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 font-medium">Vendor</th>
                  <th className="text-left py-3 px-4 font-medium">Contact</th>
                  <th className="text-center py-3 px-4 font-medium">1099</th>
                  <th className="text-right py-3 px-4 font-medium">Balance</th>
                  <th className="text-center py-3 px-4 font-medium">Status</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor: Vendor) => (
                  <tr key={vendor.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span className="font-medium">{vendor.name}</span>
                      <p className="text-sm text-muted-foreground">{vendor.code}</p>
                    </td>
                    <td className="py-3 px-4">
                      {vendor.email && <p className="text-sm">{vendor.email}</p>}
                      {vendor.phone && <p className="text-sm text-muted-foreground">{vendor.phone}</p>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {vendor.is1099Eligible && (
                        <span className="px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">
                          1099
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      <span className={cn(vendor.balance > 0 && 'text-red-600')}>
                        {formatCurrency(vendor.balance)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={cn(
                        'px-2 py-1 rounded text-xs',
                        vendor.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      )}>
                        {vendor.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
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
