import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './routes/ProtectedRoute';
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import ExpenseListPage from './pages/expenses/ExpenseListPage';
import ExpenseFormPage from './pages/expenses/ExpenseFormPage';
import SummaryReportPage from './pages/reports/SummaryReportPage';
import MonthlyReportPage from './pages/reports/MonthlyReportPage';
import FinancialYearReportPage from './pages/reports/FinancialYearReportPage';
import CustomizedReportPage from './pages/reports/CustomizedReportPage';
import SettingsPage from './pages/settings/SettingsPage';
import CompanyListPage from './pages/companies/CompanyListPage';
import ExpenseViewSkeleton from './components/common/ExpenseViewSkeleton';
import ReportDetailSkeleton from './components/common/ReportDetailSkeleton';

const ExpenseViewPage = lazy(() => import('./pages/expenses/ExpenseViewPage'));
const MonthlyDetailPage = lazy(() => import('./pages/reports/MonthlyDetailPage'));
const FinancialYearDetailPage = lazy(() => import('./pages/reports/FinancialYearDetailPage'));

function PublicOnly({ children }) {
  const { isAuthenticated } = useSelector((state) => state.auth);
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
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
          <Route path="entries" element={<ExpenseListPage />} />
          <Route path="entries/new" element={<ExpenseFormPage />} />
          <Route path="entries/:id" element={
            <Suspense fallback={<ExpenseViewSkeleton />}>
              <ExpenseViewPage />
            </Suspense>
          } />
          <Route path="entries/:id/edit" element={<ExpenseFormPage />} />
          <Route path="reports/summary" element={<SummaryReportPage />} />
          <Route path="reports/customized" element={<CustomizedReportPage />} />
          <Route path="reports/monthly" element={<MonthlyReportPage />} />
          <Route path="reports/monthly/detail" element={
            <Suspense fallback={<ReportDetailSkeleton />}>
              <MonthlyDetailPage />
            </Suspense>
          } />
          <Route path="reports/financial-year" element={<FinancialYearReportPage />} />
          <Route path="reports/financial-year/detail" element={
            <Suspense fallback={<ReportDetailSkeleton />}>
              <FinancialYearDetailPage />
            </Suspense>
          } />
          <Route path="companies" element={<CompanyListPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
