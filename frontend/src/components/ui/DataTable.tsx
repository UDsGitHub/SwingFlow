import { ReactNode } from 'react';
import { ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';

export interface ColDef<SortKey extends string> {
  key: SortKey | '_';
  label: ReactNode;
  cols: string;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
}

interface DataTableProps<SortKey extends string> {
  columns: ColDef<SortKey>[];
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onSort?: (key: SortKey) => void;
  children: ReactNode;
  /** When true, body shows emptyState instead of children */
  isEmpty?: boolean;
  emptyState?: ReactNode;
  id?: string;
}

export function DataTable<SortKey extends string>({
  columns,
  sortKey,
  sortDir,
  onSort,
  children,
  isEmpty = false,
  emptyState,
  id,
}: DataTableProps<SortKey>) {
  const hasSortable = columns.some(c => c.sortable && c.key !== '_');

  return (
    <div id={id} className="bg-surface-800 rounded-2xl border border-surface-700 overflow-hidden">
      <div className="grid grid-cols-12 px-5 py-3 border-b border-surface-700">
        {columns.map((col, i) => (
          <TableHeader
            key={`${String(col.key)}-${i}`}
            col={col}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            hasSortable={hasSortable}
          />
        ))}
      </div>
      {isEmpty && emptyState ? (
        <div className="px-5 py-12">{emptyState}</div>
      ) : (
        children
      )}
    </div>
  );
}

function TableHeader<SortKey extends string>({
  col,
  sortKey,
  sortDir,
  onSort,
  hasSortable,
}: {
  col: ColDef<SortKey>;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onSort?: (key: SortKey) => void;
  hasSortable: boolean;
}) {
  const alignClass =
    col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start';
  const labelClass = 'text-sf-field text-gray-400';

  const sortable = Boolean(col.sortable && col.key !== '_' && onSort && hasSortable);
  const isActive = sortable && col.key === sortKey;

  if (!sortable) {
    return (
      <span className={`${col.cols} flex items-center ${alignClass} ${labelClass}`}>
        {col.label}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => { onSort?.(col.key as SortKey); }}
      className={`${col.cols} flex items-center gap-1 ${alignClass} ${labelClass} transition-colors ${
        isActive ? 'text-gray-200' : 'text-gray-400 hover:text-gray-300'
      }`}
    >
      {col.label}
      {isActive ? (
        sortDir === 'asc' ? (
          <ArrowUp size={10} className="text-gray-300" />
        ) : (
          <ArrowDown size={10} className="text-gray-300" />
        )
      ) : (
        <ChevronsUpDown size={10} className="opacity-40" />
      )}
    </button>
  );
}
