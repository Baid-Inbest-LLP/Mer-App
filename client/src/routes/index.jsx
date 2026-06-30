import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import AppLayout from '../components/layout/AppLayout';
import LoginPage from '../pages/auth/LoginPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage';
import DashboardPage from '../pages/dashboard/DashboardPage';
import ExpenseListPage from '../pages/expenses/ExpenseListPage';
import ExpenseFormPage from '../pages/expenses/ExpenseFormPage';
import ExpenseViewPage from '../pages/expenses/ExpenseViewPage';
import SummaryReportPage from '../pages/reports/SummaryReportPage';
import CustomizedReportPage from '../pages/reports/CustomizedReportPage';
import MonthlyReportPage from '../pages/reports/MonthlyReportPage';
import FinancialYearReportPage from '../pages/reports/FinancialYearReportPage';
import FinancialYearDetailPage from '../pages/reports/FinancialYearDetailPage';
import SettingsPage from '../pages/settings/SettingsPage';
import CompanyListPage from '../pages/companies/CompanyListPage';

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
        <Route path="entries/:id" element={<ExpenseViewPage />} />
        <Route path="reports/summary" element={<SummaryReportPage />} />
        <Route path="reports/customized" element={<CustomizedReportPage />} />
        <Route path="reports/monthly" element={<MonthlyReportPage />} />
        <Route path="reports/financial-year" element={<FinancialYearReportPage />} />
        <Route path="reports/financial-year/detail" element={<FinancialYearDetailPage />} />
        <Route path="companies" element={<CompanyListPage />} />
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
