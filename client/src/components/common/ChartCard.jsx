export default function ChartCard({
  title,
  icon,
  iconBg,
  children,
  className = '',
  bodyClassName = 'p-4',
  headerRight,
}) {
  return (
    <div className={`card ${className}`}>
      <div className="px-4 sm:px-6 py-3 sm:py-4 max-[1440px]:sm:px-4 max-[1440px]:sm:py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2 sm:gap-3 chart-card-header">
        <div
          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}
        >
          {icon}
        </div>
        <div className="flex sm:flex-row sm:items-center justify-between w-full gap-2 sm:gap-3 min-w-0">
          <h3 className="text-sm sm:text-base lg:text-lg xl:text-xl font-semibold text-gray-700 tracking-tight whitespace-nowrap">
            {title}
          </h3>
          {headerRight}
        </div>
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}
