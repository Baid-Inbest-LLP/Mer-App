import { Link } from 'react-router-dom';

const plusIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

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
                  {plusIcon}
                  {act.label}
                </Link>
              ) : (
                <button
                  key={act.label}
                  type="button"
                  onClick={act.onClick}
                  className={actionClassName}
                >
                  {plusIcon}
                  {act.label}
                </button>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
