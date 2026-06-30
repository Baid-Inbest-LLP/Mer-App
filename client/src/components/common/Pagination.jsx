export const TABLE_PAGE_SIZE = 20;

export default function Pagination({ page, pages, total, pageSize = TABLE_PAGE_SIZE, onPageChange, loading }) {
  if (pages <= 1 && total <= pageSize) return null;

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50/50 pagination-bar">
      <p className="text-sm pagination-summary">
        Showing <span className="font-semibold pagination-summary-strong">{start}</span>–
        <span className="font-semibold pagination-summary-strong">{end}</span> of{' '}
        <span className="font-semibold pagination-summary-strong">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => onPageChange(page - 1)}
          className="pagination-btn"
        >
          Previous
        </button>
        <span className="text-sm pagination-page-label tabular-nums px-2">
          Page {page} of {Math.max(1, pages)}
        </span>
        <button
          type="button"
          disabled={page >= pages || loading}
          onClick={() => onPageChange(page + 1)}
          className="pagination-btn"
        >
          Next
        </button>
      </div>
    </div>
  );
}
