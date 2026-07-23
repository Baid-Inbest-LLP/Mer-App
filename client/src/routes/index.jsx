import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import AppLayout from '../components/layout/AppLayout';
import LoginPage from '../pages/auth/LoginPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage';
import DashboardPage from '../pages/dashboard/DashboardPage';
import ExpenseListPage from '../pages/expenses/ExpenseListPage';
import ExpenseFormPage from '../pages/expenses/ExpenseFormPage';
import ApprovedPurchaseOrdersPage from '../pages/purchase-orders/ApprovedPurchaseOrdersPage';
import PurchaseOrderDetailPage from '../pages/purchase-orders/PurchaseOrderDetailPage';
import SummaryReportPage from '../pages/reports/SummaryReportPage';
import CustomizedReportPage from '../pages/reports/CustomizedReportPage';
import MonthlyReportPage from '../pages/reports/MonthlyReportPage';
import FinancialYearReportPage from '../pages/reports/FinancialYearReportPage';
import SettingsPage from '../pages/settings/SettingsPage';
import ControlCenterPage from '../pages/control-center/ControlCenterPage';
import ExpenseViewSkeleton from '../components/common/ExpenseViewSkeleton';
import ReportDetailSkeleton from '../components/common/ReportDetailSkeleton';

const ExpenseViewPage = lazy(() => import('../pages/expenses/ExpenseViewPage'));
const FinancialYearDetailPage = lazy(() => import('../pages/reports/FinancialYearDetailPage'));

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
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
        <Route path="entries/:id/edit" element={<ExpenseFormPage />} />
        <Route path="entries/:id" element={
          <Suspense fallback={<ExpenseViewSkeleton />}>
            <ExpenseViewPage />
          </Suspense>
        } />
        <Route path="purchase-orders" element={<ApprovedPurchaseOrdersPage />} />
        <Route path="purchase-orders/:id" element={<PurchaseOrderDetailPage />} />
        <Route path="reports/summary" element={<SummaryReportPage />} />
        <Route path="reports/customized" element={<CustomizedReportPage />} />
        <Route path="reports/monthly" element={<MonthlyReportPage />} />
        <Route path="reports/financial-year" element={<FinancialYearReportPage />} />
        <Route path="reports/financial-year/detail" element={
          <Suspense fallback={<ReportDetailSkeleton />}>
            <FinancialYearDetailPage />
          </Suspense>
        } />
        <Route path="control-center/*" element={<ControlCenterPage />} />
        <Route path="companies" element={<Navigate to="/control-center/companies" replace />} />
        <Route
          path="settings"
          element={
            <ProtectedRoute roles={['superadmin', 'admin']}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
