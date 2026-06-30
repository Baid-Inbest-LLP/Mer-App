export const TABLE_PAGE_SIZE = 20;

export default function Pagination({ page, pages, total, pageSize = TABLE_PAGE_SIZE, onPageChange, loading }) {
  if (pages <= 1 && total <= pageSize) return null;

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50/50 pagination-bar">
      <p className="text-sm text-gray-600">
        Showing <span className="font-semibold text-gray-800">{start}</span>–
        <span className="font-semibold text-gray-800">{end}</span> of{' '}
        <span className="font-semibold text-gray-800">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        <span className="text-sm text-gray-600 tabular-nums px-2">
          Page {page} of {Math.max(1, pages)}
        </span>
        <button
          type="button"
          disabled={page >= pages || loading}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
