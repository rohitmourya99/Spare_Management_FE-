import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from './store/useAuthStore';
import { UserRole } from './types';
import { Layout } from './components/layout';
import { LoginPage } from './pages/auth/LoginPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { InventoryListPage } from './pages/inventory/InventoryListPage';
import { StockListPage } from './pages/inventory/StockListPage';
import { SpareDetailPage } from './pages/inventory/SpareDetailPage';
import { DispatchListPage } from './pages/dispatch/DispatchListPage';
import { PickupListPage } from './pages/pickup/PickupListPage';
import { SiteListPage } from './pages/sites/SiteListPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { ActivityLogPage } from './pages/activity/ActivityLogPage';
import UserListPage from './pages/users/UserListPage';
import { OrganizationProvider } from './context/OrganizationContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const AccessDeniedView: React.FC = () => {
  const { user } = useAuthStore();
  return (
    <Layout title="403 Forbidden - Access Denied">
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4 shadow-sm border border-rose-200">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 mb-2">403 Forbidden - Access Denied</h1>
        <p className="text-xs text-slate-600 max-w-md mb-6 font-medium leading-relaxed">
          You do not have administrative permission to access this module under your assigned role: <span className="font-extrabold text-slate-900 uppercase bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{user?.role || 'UNAUTHORIZED'}</span>.
        </p>
        <Link
          to="/dashboard"
          className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 transition-all hover:-translate-y-0.5"
        >
          Return to Dashboard
        </Link>
      </div>
    </Layout>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode; roles?: UserRole[] }> = ({ children, roles }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && user && !roles.includes(user.role)) {
    return <AccessDeniedView />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <OrganizationProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute roles={['SUPER_ADMIN', 'INVENTORY_ADMIN', 'ENGINEER', 'READ_ONLY']}>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stock-list"
              element={
                <ProtectedRoute roles={['SUPER_ADMIN', 'INVENTORY_ADMIN', 'ENGINEER', 'READ_ONLY']}>
                  <StockListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stock"
              element={
                <ProtectedRoute roles={['SUPER_ADMIN', 'INVENTORY_ADMIN', 'ENGINEER', 'READ_ONLY']}>
                  <StockListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory"
              element={
                <ProtectedRoute roles={['SUPER_ADMIN', 'INVENTORY_ADMIN', 'ENGINEER', 'READ_ONLY']}>
                  <InventoryListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory/:id"
              element={
                <ProtectedRoute roles={['SUPER_ADMIN', 'INVENTORY_ADMIN', 'ENGINEER', 'READ_ONLY']}>
                  <SpareDetailPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dispatch"
              element={
                <ProtectedRoute roles={['SUPER_ADMIN', 'INVENTORY_ADMIN', 'ENGINEER']}>
                  <DispatchListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pickup"
              element={
                <ProtectedRoute roles={['SUPER_ADMIN', 'INVENTORY_ADMIN', 'ENGINEER']}>
                  <PickupListPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/sites"
              element={
                <ProtectedRoute roles={['SUPER_ADMIN', 'INVENTORY_ADMIN', 'READ_ONLY']}>
                  <SiteListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute roles={['SUPER_ADMIN', 'INVENTORY_ADMIN', 'READ_ONLY']}>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/settings"
              element={
                <ProtectedRoute roles={['SUPER_ADMIN']}>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/activity"
              element={
                <ProtectedRoute roles={['SUPER_ADMIN']}>
                  <ActivityLogPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute roles={['SUPER_ADMIN']}>
                  <UserListPage />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </OrganizationProvider>
  );
};

export const AppRouter = App;
export default App;
