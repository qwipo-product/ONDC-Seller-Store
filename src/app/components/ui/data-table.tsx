import type { ReactNode } from "react";

interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => ReactNode);
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string | number;
  emptyState?: ReactNode;
  onRowClick?: (row: T) => void;
  maxHeight?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyState,
  onRowClick,
  maxHeight = "calc(100vh - 16rem)",
}: DataTableProps<T>) {
  const getCellValue = (row: T, column: Column<T>) => {
    if (typeof column.accessor === "function") {
      return column.accessor(row);
    }
    return row[column.accessor] as ReactNode;
  };

  if (data.length === 0 && emptyState) {
    return <div className="bg-white rounded-lg border border-gray-200">{emptyState}</div>;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full align-middle">
          <div className="overflow-hidden">
            {/* Fixed Header */}
            <div className="bg-gray-50 border-b border-gray-200">
              <div className="min-w-full">
                <div className="flex">
                  {columns.map((column, index) => (
                    <div
                      key={index}
                      className={`px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider ${
                        column.headerClassName || ""
                      }`}
                    >
                      {column.header}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Scrollable Body */}
            <div
              className="overflow-y-auto"
              style={{ maxHeight }}
            >
              <div className="min-w-full divide-y divide-gray-200">
                {data.map((row) => (
                  <div
                    key={keyExtractor(row)}
                    onClick={() => onRowClick?.(row)}
                    className={`flex hover:bg-gray-50 transition-colors ${
                      onRowClick ? "cursor-pointer" : ""
                    }`}
                  >
                    {columns.map((column, index) => (
                      <div
                        key={index}
                        className={`px-6 py-4 text-sm text-gray-900 ${
                          column.className || ""
                        }`}
                      >
                        {getCellValue(row, column)}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
