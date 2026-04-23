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
  onSort: (key: SortKey) => void;
  children: ReactNode;
  id?: string;
}

export function DataTable<SortKey extends string>({
  columns, sortKey, sortDir, onSort, children, id,
}: DataTableProps<SortKey>) {
  return (
    <div id={id} className="bg-surface-800 rounded-2xl border border-surface-700 overflow-hidden">
      {/* Column headers */}
      <div className="grid grid-cols-12 px-5 py-3 border-b border-surface-700">
        {columns.map(col => (
          <TableHeader key={col.key} col={col} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        ))}
      </div>
      {children}
    </div>
  );
}

function TableHeader<SortKey extends string>({
  col, sortKey, sortDir, onSort,
}: {
  col: ColDef<SortKey>;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
}) {
  const isActive = col.sortable && col.key !== '_' && col.key === sortKey;
  const alignClass = col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start';

  if (!col.sortable || col.key === '_') {
    return (
      <span className={`${col.cols} flex items-center ${alignClass} tracking-wide text-xs font-medium text-gray-400`}>
        {col.label}
      </span>
    );
  }

  return (
    <button
      onClick={() => col.key !== '_' && onSort(col.key as SortKey)}
      className={`${col.cols} flex items-center gap-1 ${alignClass} tracking-wide text-xs font-medium transition-colors ${
        isActive ? 'text-gray-200' : 'text-gray-400 hover:text-gray-300'
      }`}
    >
      {col.label}
      {isActive
        ? (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)
        : <ChevronsUpDown size={10} className="opacity-40" />}
    </button>
  );
}
