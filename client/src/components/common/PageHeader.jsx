export default function PageHeader({
  title,
  description,
  actionLabel,
  onAction,
  leftSection,
  children,
}) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {actionLabel && onAction && (
          <button type="button" onClick={onAction} className="btn-primary">
            {leftSection}
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
