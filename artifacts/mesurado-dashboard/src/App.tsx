import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import LoginPage from '@/pages/login';
import SignupPage from '@/pages/signup';
import OverviewPage from '@/pages/overview';
import AnalyticsPage from '@/pages/analytics';
import ApiKeysPage from '@/pages/api-keys';
import BillingPage from '@/pages/billing';
import PlaygroundPage from '@/pages/playground';
import AddFundsPage from '@/pages/add-funds';
import AdminPaymentsPage from '@/pages/admin-payments';
import NotFound from '@/pages/not-found';
import { DashboardLayout } from '@/components/dashboard/layout';

const queryClient = new QueryClient();

function RootRedirect() {
  const { isLoggedIn } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(isLoggedIn ? '/overview' : '/login');
  }, [isLoggedIn, setLocation]);
  return null;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (!isLoggedIn) { setLocation('/login'); return; }
    // isAdmin starts false, give the role fetch a moment before redirecting
    const t = setTimeout(() => {
      if (!isAdmin) setLocation('/overview');
    }, 1500);
    return () => clearTimeout(t);
  }, [isLoggedIn, isAdmin, setLocation]);
  if (!isLoggedIn || !isAdmin) return null;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/overview">
        <DashboardLayout><OverviewPage /></DashboardLayout>
      </Route>
      <Route path="/analytics">
        <DashboardLayout><AnalyticsPage /></DashboardLayout>
      </Route>
      <Route path="/api-keys">
        <DashboardLayout><ApiKeysPage /></DashboardLayout>
      </Route>
      <Route path="/billing">
        <DashboardLayout><BillingPage /></DashboardLayout>
      </Route>
      <Route path="/add-funds">
        <DashboardLayout><AddFundsPage /></DashboardLayout>
      </Route>
      <Route path="/playground">
        <DashboardLayout noPadding><PlaygroundPage /></DashboardLayout>
      </Route>
      <Route path="/admin">
        <DashboardLayout>
          <AdminGuard><AdminPaymentsPage /></AdminGuard>
        </DashboardLayout>
      </Route>
      <Route path="/" component={RootRedirect} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
