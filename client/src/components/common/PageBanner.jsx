import { Link } from 'react-router-dom';
import excelIconSrc from '../../assets/excel.svg';
import pdfIconSrc from '../../assets/pdf.svg';

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

const excelIcon = <img src={excelIconSrc} alt="" className="w-5 h-5" aria-hidden />;
const pdfIcon = <img src={pdfIconSrc} alt="" className="w-5 h-5" aria-hidden />;

const resolveActionIcon = (icon) => {
  if (icon === false || icon === 'none') return null;
  if (icon === 'arrow') return arrowRightIcon;
  if (icon === 'key') return keyIcon;
  if (icon === 'excel') return excelIcon;
  if (icon === 'pdf') return pdfIcon;
  return plusIcon;
};

const renderActionContent = (act) => {
  const icon = resolveActionIcon(act.icon);
  if (act.loading) {
    return (
      <>
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        {act.label}
      </>
    );
  }
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

const actionBaseClassName =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed';

const actionVariantClassName = {
  default:
    'bg-white text-primary-800 hover:bg-primary-50 shadow-lg shadow-primary-900/30 px-5 rounded-xl font-bold active:scale-95 transition-all duration-150',
  pdf: 'text-red-800 bg-red-50 border border-red-200 hover:bg-red-100 hover:border-red-300',
  excel: 'text-green-800 bg-green-50 border border-green-200 hover:bg-green-100 hover:border-green-300',
};

const resolveActionClassName = (act) => {
  const variant = act.variant
    || (act.icon === 'pdf' ? 'pdf' : act.icon === 'excel' ? 'excel' : 'default');
  return `${actionBaseClassName} ${actionVariantClassName[variant] || actionVariantClassName.default}`;
};

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
          <div className="flex flex-wrap items-center gap-2 justify-end flex-shrink-0">
            {actionsList.map((act) =>
              act.to ? (
                <Link key={`${act.to}-${act.label}`} to={act.to} className={resolveActionClassName(act)}>
                  {renderActionContent(act)}
                </Link>
              ) : (
                <button
                  key={act.label}
                  type="button"
                  onClick={act.onClick}
                  disabled={act.disabled}
                  className={resolveActionClassName(act)}
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
