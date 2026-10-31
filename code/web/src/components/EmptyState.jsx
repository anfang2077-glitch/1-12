export default function EmptyState({ icon = '📭', title = '暂无数据', description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon" aria-hidden="true">
        {icon}
      </div>
      <div className="empty-title">{title}</div>
      {description && <div className="empty-desc">{description}</div>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}
