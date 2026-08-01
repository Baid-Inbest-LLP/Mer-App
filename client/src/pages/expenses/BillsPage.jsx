import { useNavigate, useSearchParams } from 'react-router-dom';
import PageBanner from '../../components/common/PageBanner';
import ExpenseListPage from './ExpenseListPage';
import DueExpensesPage from './DueExpensesPage';
import RecurringSchedulesSection from './RecurringSchedulesSection';

const TABS = [
  { value: 'all', label: 'All Bills' },
  { value: 'due', label: 'Due Bills (Unpaid)' },
  { value: 'paid', label: 'Expenses (Paid)' },
  { value: 'recurring', label: 'Recurring bills' },
];

const SUBTITLES = {
  all: 'All bills — paid and unpaid',
  due: 'Unpaid, partially paid, and held bills',
  paid: 'Fully paid bills (expenses) — approval Completed',
  recurring: 'Recurring schedules — pause, resume, edit, or stop them',
};

export default function BillsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab = TABS.some((t) => t.value === tabParam) ? tabParam : 'all';

  const setTab = (value) => {
    setSearchParams(value === 'all' ? {} : { tab: value });
  };

  const showAdd = tab === 'all' || tab === 'paid';

  return (
    <div>
      <PageBanner
        className="mb-4"
        title="Bills/Expenses"
        subtitle={SUBTITLES[tab]}
        action={showAdd ? { onClick: () => navigate('/entries/new'), label: 'Add Bill' } : undefined}
      />

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`bills-page-tab px-4 py-2 text-sm font-semibold rounded-lg whitespace-nowrap transition-colors ${
              tab === t.value
                ? 'bills-page-tab--active bg-primary-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'all' && <ExpenseListPage key="all" embedded />}
      {tab === 'due' && <DueExpensesPage embedded />}
      {tab === 'paid' && <ExpenseListPage key="paid" embedded statusFilter="Paid" variant="paid" />}
      {tab === 'recurring' && <RecurringSchedulesSection />}
    </div>
  );
}
