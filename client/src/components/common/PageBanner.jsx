import { Link } from 'react-router-dom';

const plusIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const arrowRightIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const keyIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
  </svg>
);

const resolveActionIcon = (icon) => {
  if (icon === false || icon === 'none') return null;
  if (icon === 'arrow') return arrowRightIcon;
  if (icon === 'key') return keyIcon;
  return plusIcon;
};

const renderActionContent = (act) => {
  const icon = resolveActionIcon(act.icon);
  if (!icon) return act.label;
  if (act.icon === 'arrow') {
    return (
      <>
        {act.label}
        {icon}
      </>
    );
  }
  return (
    <>
      {icon}
      {act.label}
    </>
  );
};

const actionClassName =
  'inline-flex items-center gap-2 px-5 py-2.5 bg-white text-primary-800 rounded-xl text-sm font-bold hover:bg-primary-50 active:scale-95 transition-all duration-150 shadow-lg shadow-primary-900/30 flex-shrink-0';

export default function PageBanner({ title, subtitle, action = null, className = '' }) {
  const actionsList = Array.isArray(action) ? action : action ? [action] : [];

  return (
    <div
      className={`bg-gradient-to-br from-[#0b2f81] via-[#1446a0] to-[#1d5fb3] rounded-2xl px-4 py-3 text-white relative overflow-hidden ${className}`.trim()}
    >
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
      <div className="absolute -bottom-8 -right-4 w-24 h-24 bg-white/5 rounded-full" />
      <div className="relative flex gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-0.5">{title}</h2>
          <p className="text-primary-200 text-md">{subtitle}</p>
        </div>
        {actionsList.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-end flex-shrink-0">
            {actionsList.map((act) =>
              act.to ? (
                <Link key={`${act.to}-${act.label}`} to={act.to} className={actionClassName}>
                  {renderActionContent(act)}
                </Link>
              ) : (
                <button
                  key={act.label}
                  type="button"
                  onClick={act.onClick}
                  className={actionClassName}
                >
                  {renderActionContent(act)}
                </button>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
