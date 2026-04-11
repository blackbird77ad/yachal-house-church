import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../utils/scoreHelpers";

const Pagination = ({ page, totalPages, onPage, totalItems, perPage, label = "items" }) => {
  if (!totalItems) return null;

  const safeTotal = totalPages || 1;
  const from = (page - 1) * perPage + 1;
  const to   = Math.min(page * perPage, totalItems);

  // Build page number buttons
  const pages = [];
  if (safeTotal <= 7) {
    for (let i = 1; i <= safeTotal; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(safeTotal - 1, page + 1); i++) pages.push(i);
    if (page < safeTotal - 2) pages.push("...");
    pages.push(safeTotal);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 py-3">
      {/* Count — always visible */}
      <p className="text-xs text-gray-400 dark:text-slate-500 order-2 sm:order-1">
        Showing{" "}
        <strong className="text-gray-700 dark:text-slate-200">{from}–{to}</strong>
        {" "}of{" "}
        <strong className="text-gray-700 dark:text-slate-200">{totalItems}</strong>{" "}
        {label}
      </p>

      {/* Page buttons — only when more than 1 page */}
      {safeTotal > 1 && (
        <div className="flex items-center gap-1 order-1 sm:order-2">
          <button
            onClick={() => onPage(page - 1)}
            disabled={page === 1}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {pages.map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className="px-1 text-gray-400 dark:text-slate-500 text-sm">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPage(p)}
                className={cn(
                  "min-w-[32px] h-8 px-2 rounded-lg text-sm font-medium transition-colors",
                  p === page
                    ? "bg-purple-600 text-white"
                    : "border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                )}
              >
                {p}
              </button>
            )
          )}
          <button
            onClick={() => onPage(page + 1)}
            disabled={page === safeTotal}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default Pagination;