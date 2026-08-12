import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { IconBellRinging } from '@tabler/icons-react';
import { expenseApi } from '../../api/expense.api';
import { formatCurrency, formatDate, formatMerSerial } from '../../utils/format';

const POLL_MS = 60_000;
const LIST_LIMIT = 12;

const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const endOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const addDays = (d, days) => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
};

const classifyDue = (dueDate) => {
  if (!dueDate) return { key: 'upcoming', label: 'Upcoming', tone: 'slate' };
  const due = new Date(dueDate);
  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const in7 = endOfDay(addDays(todayStart, 7));
  if (due < todayStart) return { key: 'overdue', label: 'Overdue', tone: 'red' };
  if (due <= todayEnd) return { key: 'due_today', label: 'Due today', tone: 'amber' };
  if (due <= in7) return { key: 'due_7', label: 'Due soon', tone: 'blue' };
  return { key: 'upcoming', label: 'Upcoming', tone: 'slate' };
};

const isNotifyWorthy = (dueDate) => {
  const { key } = classifyDue(dueDate);
  return key === 'overdue' || key === 'due_today' || key === 'due_7';
};

export default function DueNotifications() {
  const navigate = useNavigate();
  const { lookups } = useSelector((state) => state.common);
  const companyCode = (name) => lookups?.companyCodeByName?.[name] || name || '—';

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [badgeCount, setBadgeCount] = useState(0);
  const panelRef = useRef(null);

  const load = useCallback(async () => {
    try {
      // Upcoming window: overdue + due within 7 days (by expected payment / due date).
      const [overdueRes, soonRes] = await Promise.all([
        expenseApi.due({
          page: 1,
          limit: LIST_LIMIT,
          bucket: 'overdue',
          sortBy: 'dueDate',
          sortOrder: 'asc',
        }),
        expenseApi.due({
          page: 1,
          limit: LIST_LIMIT,
          bucket: 'due_7',
          sortBy: 'dueDate',
          sortOrder: 'asc',
        }),
      ]);

      const overdue = overdueRes.data?.data || [];
      const soon = soonRes.data?.data || [];
      const overdueTotal = overdueRes.data?.pagination?.total ?? overdue.length;
      const soonTotal = soonRes.data?.pagination?.total ?? soon.length;

      const seen = new Set();
      const merged = [];
      for (const row of [...overdue, ...soon]) {
        if (seen.has(row._id)) continue;
        if (!isNotifyWorthy(row.dueDate)) continue;
        seen.add(row._id);
        merged.push(row);
      }
      merged.sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0));

      setItems(merged.slice(0, LIST_LIMIT));
      setBadgeCount(overdueTotal + soonTotal);
    } catch {
      // Keep last good state; bell stays quiet on transient errors.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleOpenBill = (id) => {
    setOpen(false);
    navigate(`/entries/${id}`, { state: { from: '/bills?tab=due' } });
  };

  return (
    <div className="navbar-due-notifications relative" ref={panelRef}>
      <button
        type="button"
        className="navbar-notify"
        aria-label={badgeCount ? `${badgeCount} upcoming due bills` : 'Due bill notifications'}
        aria-expanded={open}
        aria-haspopup="true"
        title="Upcoming due bills"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
      >
        <IconBellRinging
          size={20}
          stroke={1.75}
          className={`navbar-notify__icon${badgeCount > 0 ? ' navbar-notify__icon--ring' : ''}`}
          aria-hidden
        />
        {badgeCount > 0 && (
          <span className="navbar-notify__badge">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="navbar-notify-panel" role="menu">
          <div className="navbar-notify-panel__header">
            <div>
              <p className="navbar-notify-panel__title">Due bills</p>
              <p className="navbar-notify-panel__subtitle">Based on expected payment date</p>
            </div>
            {badgeCount > 0 && (
              <span className="navbar-notify-panel__count">{badgeCount}</span>
            )}
          </div>

          <div className="navbar-notify-panel__body">
            {loading && items.length === 0 ? (
              <p className="navbar-notify-panel__empty">Loading…</p>
            ) : items.length === 0 ? (
              <p className="navbar-notify-panel__empty">No upcoming due bills in the next 7 days</p>
            ) : (
              <ul className="navbar-notify-list">
                {items.map((e) => {
                  const tag = classifyDue(e.dueDate);
                  return (
                    <li key={e._id}>
                      <button
                        type="button"
                        className="navbar-notify-item"
                        onClick={() => handleOpenBill(e._id)}
                      >
                        <div className="navbar-notify-item__top">
                          <span className="navbar-notify-item__serial">
                            {formatMerSerial(e.slNo) || 'Bill'}
                          </span>
                          <span className={`navbar-notify-tag navbar-notify-tag--${tag.tone}`}>
                            {tag.label}
                          </span>
                        </div>
                        <div className="navbar-notify-item__meta">
                          <span className="navbar-notify-item__company">
                            {companyCode(e.company)}
                          </span>
                          <span className="navbar-notify-item__dot">·</span>
                          <span>{e.headOfExpense || '—'}</span>
                        </div>
                        <div className="navbar-notify-item__bottom">
                          <span className={tag.key === 'overdue' ? 'text-red-600 font-semibold' : ''}>
                            Due {formatDate(e.dueDate)}
                          </span>
                          <span className="navbar-notify-item__amount">
                            {formatCurrency(e.balanceDue)}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="navbar-notify-panel__footer">
            <Link
              to="/bills?tab=due"
              className="navbar-notify-panel__link"
              onClick={() => setOpen(false)}
            >
              View all due bills
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
