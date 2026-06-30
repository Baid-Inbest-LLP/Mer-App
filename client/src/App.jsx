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
import ExpenseViewPage from './pages/expenses/ExpenseViewPage';
import SummaryReportPage from './pages/reports/SummaryReportPage';
import MonthlyReportPage from './pages/reports/MonthlyReportPage';
import MonthlyDetailPage from './pages/reports/MonthlyDetailPage';
import FinancialYearReportPage from './pages/reports/FinancialYearReportPage';
import FinancialYearDetailPage from './pages/reports/FinancialYearDetailPage';
import SettingsPage from './pages/settings/SettingsPage';
import CompanyListPage from './pages/companies/CompanyListPage';

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
          <Route path="entries/:id" element={<ExpenseViewPage />} />
          <Route path="entries/:id/edit" element={<ExpenseFormPage />} />
          <Route path="reports/summary" element={<SummaryReportPage />} />
          <Route path="reports/monthly" element={<MonthlyReportPage />} />
          <Route path="reports/monthly/detail" element={<MonthlyDetailPage />} />
          <Route path="reports/financial-year" element={<FinancialYearReportPage />} />
          <Route path="reports/financial-year/detail" element={<FinancialYearDetailPage />} />
          <Route path="companies" element={<CompanyListPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
