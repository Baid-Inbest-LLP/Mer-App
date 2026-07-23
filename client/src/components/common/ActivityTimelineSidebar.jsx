import { formatDate } from '../../utils/format';

/**
 * Sticky Activity sidebar matching MER expense detail timeline.
 * @param {{ events: Array<{ key: string, label: string, date: string|Date, actor?: string, dotClass: string, iconBg: string, iconColor: string, icon: import('react').ReactNode }> }} props
 */
export default function ActivityTimelineSidebar({ events = [], title = 'Activity' }) {
  if (!events.length) return null;

  return (
    <aside className="expense-timeline-sidebar card p-5 w-full">
      <div className="expense-timeline-header flex items-center justify-between gap-2 pb-4 mb-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="expense-timeline-header-icon w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 className="expense-timeline-title text-sm font-bold">{title}</h2>
          </div>
        </div>
      </div>

      <ol className="expense-timeline-line relative ml-3 border-l-2">
        {events.map((event, index) => (
          <li key={event.key} className={`relative pl-6 ${index < events.length - 1 ? 'pb-5' : ''}`}>
            <span
              className={`expense-timeline-dot absolute -left-[7px] top-1 h-3 w-3 rounded-full ring-4 ${event.dotClass}`}
              aria-hidden="true"
            />
            <div
              className={`w-7 h-7 rounded-md flex items-center justify-center mb-2 ${event.iconBg} ${event.iconColor}`}
            >
              {event.icon}
            </div>
            <p className="expense-timeline-event-title text-sm font-semibold leading-tight">{event.label}</p>
            <p className="expense-timeline-event-date text-xs mt-1">{formatDate(event.date)}</p>
            <p className="expense-timeline-event-by text-xs mt-1.5 leading-snug">
              <span className="expense-timeline-event-actor-label">By</span>{' '}
              <span className="expense-timeline-event-actor font-medium">{event.actor || '—'}</span>
            </p>
          </li>
        ))}
      </ol>
    </aside>
  );
}

const ICON_CREATED = (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const ICON_APPROVED = (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const ICON_COMPLETED = (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ICON_REJECTED = (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

/** Build timeline events for a purchase order (Mer-App / PO-Software). */
export function buildPurchaseOrderTimelineEvents(order) {
  if (!order) return [];

  const events = [];
  const actorName = (user) => user?.name || user?.email || '—';

  if (order.createdAt) {
    events.push({
      key: 'created',
      label: 'Created',
      date: order.createdAt,
      actor: actorName(order.createdBy),
      dotClass: 'bg-blue-500',
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      icon: ICON_CREATED,
    });
  }

  if (order.approvedByAdminAt) {
    events.push({
      key: 'completed',
      label: 'Completed',
      date: order.approvedByAdminAt,
      actor: actorName(order.approvedByAdmin),
      dotClass: 'bg-emerald-500',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      icon: ICON_COMPLETED,
    });
  }

  if (order.completedAt || order.status === 'completed') {
    events.push({
      key: 'approved',
      label: 'Approved',
      date: order.completedAt || order.updatedAt,
      actor: actorName(order.completedBy),
      dotClass: 'bg-indigo-500',
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      icon: ICON_APPROVED,
    });
  }

  if (order.status === 'rejected') {
    events.push({
      key: 'rejected',
      label: 'Rejected',
      date: order.updatedAt || order.createdAt,
      actor: actorName(order.approvedByAdmin || order.completedBy),
      dotClass: 'bg-red-500',
      iconBg: 'bg-red-50',
      iconColor: 'text-red-600',
      icon: ICON_REJECTED,
    });
  }

  return events;
}
