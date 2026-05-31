import React from 'react';

type Column<T> = {
  title: string;
  render: (row: T) => React.ReactNode;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  emptyText?: string;
  onRowClick?: (row: T) => void;
};

export default function Table<T>({ columns, rows, emptyText = 'Sem dados.', onRowClick }: Props<T>) {
  const handleRowClick = (event: React.MouseEvent<HTMLTableRowElement>, row: T) => {
    if (!onRowClick) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea, label')) {
      return;
    }
    onRowClick(row);
  };

  return (
    <div className="table-wrapper">
      <table className="table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.title}>{column.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="empty-cell">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr 
                key={idx} 
                onClick={(event) => handleRowClick(event, row)}
                style={{ cursor: onRowClick ? 'pointer' : 'default' }}
              >
                {columns.map((column) => (
                  <td key={column.title}>{column.render(row)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
