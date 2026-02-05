import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
}

interface Company {
  id: string;
  name: string;
  logo: string | null;
  role: string;
  isDefault: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  companies: Company[];
  currentCompanyId: string | null;

  setUser: (user: User | null) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setCompanies: (companies: Company[]) => void;
  setCurrentCompany: (companyId: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      companies: [],
      currentCompanyId: null,

      setUser: (user) => set({ user }),

      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),

      setCompanies: (companies) => {
        const defaultCompany = companies.find((c) => c.isDefault);
        set({
          companies,
          currentCompanyId: defaultCompany?.id || companies[0]?.id || null,
        });
      },

      setCurrentCompany: (companyId) => set({ currentCompanyId: companyId }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          companies: [],
          currentCompanyId: null,
        }),

      isAuthenticated: () => !!get().accessToken,
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        currentCompanyId: state.currentCompanyId,
      }),
    }
  )
);
