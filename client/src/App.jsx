import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './routes/ProtectedRoute';
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import BillsPage from './pages/expenses/BillsPage';
import ExpenseFormPage from './pages/expenses/ExpenseFormPage';
import ApprovedPurchaseOrdersPage from './pages/purchase-orders/ApprovedPurchaseOrdersPage';
import PurchaseOrderDetailPage from './pages/purchase-orders/PurchaseOrderDetailPage';
import SummaryReportPage from './pages/reports/SummaryReportPage';
import MonthlyReportPage from './pages/reports/MonthlyReportPage';
import FinancialYearReportPage from './pages/reports/FinancialYearReportPage';
import CustomizedReportPage from './pages/reports/CustomizedReportPage';
import SettingsPage from './pages/settings/SettingsPage';
import ControlCenterPage from './pages/control-center/ControlCenterPage';
import ExpenseViewSkeleton from './components/common/ExpenseViewSkeleton';
import ReportDetailSkeleton from './components/common/ReportDetailSkeleton';
import { normalizeReportScope } from './utils/reportScope';

const ExpenseViewPage = lazy(() => import('./pages/expenses/ExpenseViewPage'));
const MonthlyDetailPage = lazy(() => import('./pages/reports/MonthlyDetailPage'));
const FinancialYearDetailPage = lazy(() => import('./pages/reports/FinancialYearDetailPage'));

function PublicOnly({ children }) {
  const { isAuthenticated } = useSelector((state) => state.auth);
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

function RedirectPreserveSearch({ to }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
}

function ReportScopeGuard({ children }) {
  const { reportScope } = useParams();
  const location = useLocation();
  if (normalizeReportScope(reportScope)) return children;
  const fallback = location.pathname.replace(`/${reportScope}`, '/expenses');
  return <Navigate to={`${fallback}${location.search}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnly>
              <LoginPage />
            </PublicOnly>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicOnly>
              <ForgotPasswordPage />
            </PublicOnly>
          }
        />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="bills" element={<BillsPage />} />
          <Route path="entries" element={<Navigate to="/bills" replace />} />
          <Route path="due-expenses" element={<Navigate to="/bills?tab=due" replace />} />
          <Route path="entries/new" element={<ExpenseFormPage />} />
          <Route path="entries/:id" element={
            <Suspense fallback={<ExpenseViewSkeleton />}>
              <ExpenseViewPage />
            </Suspense>
          } />
          <Route path="entries/:id/edit" element={<ExpenseFormPage />} />
          <Route path="purchase-orders" element={<ApprovedPurchaseOrdersPage />} />
          <Route path="purchase-orders/:id" element={<PurchaseOrderDetailPage />} />
          <Route path="reports/summary" element={<RedirectPreserveSearch to="/reports/summary/expenses" />} />
          <Route
            path="reports/summary/:reportScope"
            element={(
              <ReportScopeGuard>
                <SummaryReportPage />
              </ReportScopeGuard>
            )}
          />
          <Route path="reports/customized" element={<RedirectPreserveSearch to="/reports/customized/expenses" />} />
          <Route
            path="reports/customized/:reportScope"
            element={(
              <ReportScopeGuard>
                <CustomizedReportPage />
              </ReportScopeGuard>
            )}
          />
          <Route path="reports/monthly/detail" element={<RedirectPreserveSearch to="/reports/monthly/expenses/detail" />} />
          <Route
            path="reports/monthly/:reportScope/detail"
            element={(
              <ReportScopeGuard>
                <Suspense fallback={<ReportDetailSkeleton />}>
                  <MonthlyDetailPage />
                </Suspense>
              </ReportScopeGuard>
            )}
          />
          <Route
            path="reports/monthly/:reportScope"
            element={(
              <ReportScopeGuard>
                <MonthlyReportPage />
              </ReportScopeGuard>
            )}
          />
          <Route path="reports/monthly" element={<RedirectPreserveSearch to="/reports/monthly/expenses" />} />
          <Route path="reports/financial-year/detail" element={<RedirectPreserveSearch to="/reports/financial-year/expenses/detail" />} />
          <Route
            path="reports/financial-year/:reportScope/detail"
            element={(
              <ReportScopeGuard>
                <Suspense fallback={<ReportDetailSkeleton />}>
                  <FinancialYearDetailPage />
                </Suspense>
              </ReportScopeGuard>
            )}
          />
          <Route
            path="reports/financial-year/:reportScope"
            element={(
              <ReportScopeGuard>
                <FinancialYearReportPage />
              </ReportScopeGuard>
            )}
          />
          <Route path="reports/financial-year" element={<RedirectPreserveSearch to="/reports/financial-year/expenses" />} />
          <Route path="control-center/*" element={<ControlCenterPage />} />
          <Route path="companies" element={<Navigate to="/control-center/companies" replace />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
