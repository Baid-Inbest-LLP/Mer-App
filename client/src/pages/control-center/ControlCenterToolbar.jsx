/**
 * Shared toolbar for Control Center sections — title, search, and primary action in one card.
 */
export default function ControlCenterToolbar({
  title,
  subtitle,
  search,
  onSearchChange,
  searchPlaceholder = 'Search...',
  actionLabel,
  onAction,
  showAction = false,
}) {
  return (
    <div className="card p-4 mb-4">
      <div className="flex gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="control-center-toolbar-title text-lg font-semibold text-gray-900">{title}</h2>
          {subtitle ? (
            <p className="control-center-toolbar-subtitle text-sm text-gray-500 mt-0.5">{subtitle}</p>
          ) : null}
        </div>

        <div className="flex sm:flex-row sm:items-center gap-2 w-full lg:w-auto">
          <input
            className="input-field w-full sm:w-64"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {showAction && actionLabel && onAction ? (
            <button
              type="button"
              className="btn-primary whitespace-nowrap w-full sm:w-auto"
              onClick={onAction}
            >
              {actionLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
