import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import PageBanner from '../../components/common/PageBanner';
import { fetchCompanies } from '../../store/slices/companiesSlice';
import CompanyListPage from '../companies/CompanyListPage';
import BankAccountsSection from './BankAccountsSection';
import CardsSection from './CardsSection';

const TABS = [
  { to: '/control-center/companies', label: 'Companies', end: true },
  { to: '/control-center/bank-accounts', label: 'Bank Accounts' },
  { to: '/control-center/cards', label: 'Cards' },
];

export default function ControlCenterPage() {
  const dispatch = useDispatch();
  const location = useLocation();

  useEffect(() => {
    dispatch(fetchCompanies({ isActive: true, limit: 100 }));
  }, [dispatch]);

  const subtitle = location.pathname.includes('bank-accounts')
    ? 'Manage payer bank accounts for expense entries'
    : location.pathname.includes('cards')
      ? 'Manage credit and debit cards for expense entries'
      : 'Legal entities, locations, bank accounts, and cards';

  return (
    <div>
      <PageBanner className="mb-4" title="Control Center" subtitle={subtitle} />

      <div className="card p-2 mb-4">
        <div className="flex flex-wrap gap-1">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `control-center-tab px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'control-center-tab--active bg-[#0b2f81] text-white shadow-sm'
                    : 'control-center-tab--inactive text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>

      <Routes>
        <Route index element={<Navigate to="companies" replace />} />
        <Route path="companies" element={<CompanyListPage embedded />} />
        <Route path="bank-accounts" element={<BankAccountsSection />} />
        <Route path="cards" element={<CardsSection />} />
      </Routes>
    </div>
  );
}
