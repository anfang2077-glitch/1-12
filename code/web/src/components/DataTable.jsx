import EmptyState from './EmptyState';
import Loading from './Loading';

function getPageNumbers(current, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const start = Math.max(1, Math.min(current - 2, totalPages - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

export default function DataTable({
  columns,
  data,
  rowKey = 'id',
  loading = false,
  emptyTitle = '暂无数据',
  emptyDescription,
  emptyIcon = '📭',
  emptyAction,
  pagination,
  footer
}) {
  const rows = Array.isArray(data) ? data : [];
  const totalPages = pagination ? Math.max(1, Math.ceil((pagination.total || 0) / (pagination.pageSize || 10))) : 1;
  const currentPage = pagination?.page || 1;

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={column.className || ''}
                style={{ width: column.width, textAlign: column.align || 'left' }}
              >
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length}>
                <Loading text="正在加载数据…" />
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="table-empty-cell">
                <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={emptyAction} />
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => {
              const key = typeof rowKey === 'function' ? rowKey(row, rowIndex) : row[rowKey] ?? rowIndex;
              return (
                <tr key={key}>
                  {columns.map((column) => (
                    <td key={column.key} className={column.className || ''} style={{ textAlign: column.align || 'left' }}>
                      {column.render ? column.render(row, rowIndex) : row[column.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {pagination && (pagination.total > 0 || loading) && (
        <div className="pagination">
          <div className="pagination-info">
            共 <strong>{pagination.total ?? 0}</strong> 条 · 第 {currentPage} / {totalPages} 页
          </div>
          <div className="pagination-controls">
            <button
              type="button"
              className="page-btn"
              onClick={() => pagination.onPageChange(currentPage - 1)}
              disabled={currentPage <= 1 || loading}
            >
              上一页
            </button>
            {getPageNumbers(currentPage, totalPages).map((page) => (
              <button
                type="button"
                key={page}
                className={`page-btn ${page === currentPage ? 'active' : ''}`}
                onClick={() => pagination.onPageChange(page)}
                disabled={page === currentPage || loading}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              className="page-btn"
              onClick={() => pagination.onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
            >
              下一页
            </button>
            {pagination.onPageSizeChange && (
              <select
                className="select page-size-select"
                value={pagination.pageSize || 10}
                onChange={(event) => pagination.onPageSizeChange(Number(event.target.value))}
                disabled={loading}
                aria-label="每页条数"
              >
                {(pagination.pageSizeOptions || [10, 20, 50]).map((size) => (
                  <option key={size} value={size}>
                    {size} 条/页
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}
      {footer}
    </div>
  );
}
