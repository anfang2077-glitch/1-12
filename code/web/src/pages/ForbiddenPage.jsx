import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { homePath } from '../utils/format';

export default function ForbiddenPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const switchAccount = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="status-page">
      <div className="status-card">
        <div className="status-code">403</div>
        <h1 className="status-title">无权限访问</h1>
        <p className="status-desc">当前账号的角色无权访问该页面，请检查地址或切换账号后重试。</p>
        <div className="status-actions">
          <button type="button" className="btn btn-primary" onClick={() => navigate(user ? homePath(user.role) : '/login')}>
            返回首页
          </button>
          <button type="button" className="btn btn-secondary" onClick={switchAccount}>
            切换账号
          </button>
        </div>
        <div className="status-links">
          <Link to="/">系统入口</Link>
        </div>
      </div>
    </div>
  );
}
