import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Truck,
  FileText,
  Receipt,
  Building2,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/features/auth/store';
import { logout } from '@/features/auth/api';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Chart of Accounts', href: '/accounts', icon: BookOpen },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Invoices', href: '/invoices', icon: FileText },
  { name: 'Vendors', href: '/vendors', icon: Truck },
  { name: 'Bills', href: '/bills', icon: Receipt },
  { name: 'Banking', href: '/banking', icon: Building2 },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
];

export function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);

  const { user, companies, currentCompanyId, setCurrentCompany } = useAuthStore();
  const currentCompany = companies.find((c) => c.id === currentCompanyId);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleCompanyChange = (companyId: string) => {
    setCurrentCompany(companyId);
    setCompanyMenuOpen(false);
    window.location.reload(); // Refresh to load new company data
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-200 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b">
            <span className="text-xl font-bold text-primary">QuickClaude</span>
          </div>

          {/* Company Selector */}
          <div className="px-4 py-3 border-b">
            <div className="relative">
              <button
                onClick={() => setCompanyMenuOpen(!companyMenuOpen)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm bg-gray-50 rounded-md hover:bg-gray-100"
              >
                <span className="truncate">{currentCompany?.name || 'Select Company'}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              {companyMenuOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-md shadow-lg border z-10">
                  {companies.map((company) => (
                    <button
                      key={company.id}
                      onClick={() => handleCompanyChange(company.id)}
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm hover:bg-gray-50',
                        company.id === currentCompanyId && 'bg-gray-50 font-medium'
                      )}
                    >
                      {company.name}
                    </button>
                  ))}
                  <Link
                    to="/companies/new"
                    className="block w-full text-left px-3 py-2 text-sm text-primary hover:bg-gray-50 border-t"
                  >
                    + Create Company
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'flex items-center px-3 py-2 text-sm rounded-md transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User Menu */}
          <div className="border-t p-4">
            <div className="flex items-center mb-3">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="ml-3 overflow-hidden">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="flex-1" asChild>
                <Link to="/settings">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={cn('transition-all duration-200', sidebarOpen ? 'ml-64' : 'ml-0')}>
        {/* Top Bar */}
        <header className="sticky top-0 z-40 bg-white border-b">
          <div className="flex items-center h-16 px-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
