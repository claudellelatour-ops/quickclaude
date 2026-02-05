import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { apiPost } from '@/api/client';
import { useAuthStore } from '@/features/auth/store';

const companySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  legalName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  baseCurrency: z.string().default('USD'),
});

type CompanyForm = z.infer<typeof companySchema>;

export function CompanySetupPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { setCompanies, setCurrentCompany } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      baseCurrency: 'USD',
    },
  });

  const onSubmit = async (data: CompanyForm) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiPost<any>('/companies', data);
      if (response.success && response.data) {
        setCompanies([{
          id: response.data.id,
          name: response.data.name,
          logo: null,
          role: 'OWNER',
          isDefault: true,
        }]);
        setCurrentCompany(response.data.id);

        // Import default chart of accounts
        await apiPost('/accounts/import-template', { template: 'service' });

        navigate('/');
      } else {
        setError(response.error?.message || 'Failed to create company');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create company');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Set Up Your Company</CardTitle>
          <CardDescription>
            Create your first company to start using QuickClaude
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Company Name *</Label>
              <Input id="name" placeholder="Acme Inc." {...register('name')} />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="legalName">Legal Name</Label>
              <Input id="legalName" placeholder="Acme Incorporated" {...register('legalName')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="info@acme.com" {...register('email')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" placeholder="(555) 123-4567" {...register('phone')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="baseCurrency">Base Currency</Label>
              <select
                id="baseCurrency"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...register('baseCurrency')}
              >
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="CAD">CAD - Canadian Dollar</option>
              </select>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating...' : 'Create Company'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
