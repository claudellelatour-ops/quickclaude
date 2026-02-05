import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store';
import { fetchCurrentUser } from '@/features/auth/api';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { AccountsPage } from '@/features/accounts/AccountsPage';
import { CustomersPage } from '@/features/customers/CustomersPage';
import { CustomerDetailPage } from '@/features/customers/CustomerDetailPage';
import { InvoicesPage } from '@/features/invoices/InvoicesPage';
import { InvoiceFormPage } from '@/features/invoices/InvoiceFormPage';
import { VendorsPage } from '@/features/vendors/VendorsPage';
import { BillsPage } from '@/features/bills/BillsPage';
import { BillFormPage } from '@/features/bills/BillFormPage';
import { BankingPage } from '@/features/banking/BankingPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { CompanySetupPage } from '@/features/companies/CompanySetupPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { accessToken, currentCompanyId } = useAuthStore();

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  if (!currentCompanyId) {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { accessToken, user } = useAuthStore();

  useEffect(() => {
    if (accessToken && !user) {
      fetchCurrentUser();
    }
  }, [accessToken, user]);

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Company setup */}
      <Route path="/setup" element={<CompanySetupPage />} />

      {/* Protected routes */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/customers/:id" element={<CustomerDetailPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/invoices/new" element={<InvoiceFormPage />} />
        <Route path="/invoices/:id/edit" element={<InvoiceFormPage />} />
        <Route path="/vendors" element={<VendorsPage />} />
        <Route path="/bills" element={<BillsPage />} />
        <Route path="/bills/new" element={<BillFormPage />} />
        <Route path="/bills/:id/edit" element={<BillFormPage />} />
        <Route path="/banking" element={<BankingPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// OAuth callback handler
function AuthCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');

    if (accessToken && refreshToken) {
      useAuthStore.getState().setTokens(accessToken, refreshToken);
      fetchCurrentUser().then(() => {
        window.location.href = '/';
      });
    } else {
      window.location.href = '/login';
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Completing sign in...</p>
    </div>
  );
}

export default App;
