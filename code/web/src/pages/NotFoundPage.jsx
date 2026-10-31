import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="status-page">
      <div className="status-card">
        <div className="status-code">404</div>
        <h1 className="status-title">页面不存在</h1>
        <p className="status-desc">访问的地址不存在，可能是链接有误或页面已被移除。</p>
        <div className="status-actions">
          <Link className="btn btn-primary" to="/">
            返回系统入口
          </Link>
        </div>
      </div>
    </div>
  );
}
