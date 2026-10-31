import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import useConfirm from '../hooks/useConfirm';
import Badge from './Badge';
import { ROLE_LABELS } from '../utils/format';
import { toast } from '../utils/toast';

const TEACHING_ITEMS = [
  { to: '/teacher/questions', label: '题库管理', icon: '📝' },
  { to: '/teacher/exams', label: '考试管理', icon: '🗂️' },
  { to: '/teacher/grading', label: '阅卷中心', icon: '✅' },
  { to: '/teacher/stats', label: '成绩统计', icon: '📊' }
];

const MENUS = {
  admin: [
    {
      title: '系统管理',
      items: [
        { to: '/admin/overview', label: '全局概览', icon: '▦' },
        { to: '/admin/users', label: '用户管理', icon: '👥' },
        { to: '/admin/courses', label: '课程管理', icon: '📚' }
      ]
    },
    { title: '教学管理', items: TEACHING_ITEMS }
  ],
  teacher: [{ title: '教学工作', items: TEACHING_ITEMS }],
  student: [
    {
      title: '学习中心',
      items: [
        { to: '/student/exams', label: '我的考试', icon: '🗓️' },
        { to: '/student/scores', label: '我的成绩', icon: '🏅' }
      ]
    }
  ]
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { ask, confirmNode } = useConfirm();
  const sections = MENUS[user?.role] || [];
  const roleTone = user?.role === 'admin' ? 'purple' : user?.role === 'teacher' ? 'blue' : 'green';

  const handleLogout = () => {
    ask({
      title: '退出登录',
      message: '确定要退出当前账号吗？',
      confirmText: '退出登录',
      danger: true,
      onConfirm: async () => {
        logout();
        toast.success('已退出登录');
        navigate('/login', { replace: true });
      }
    });
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <div className="brand-logo">考</div>
          <div className="brand-text">
            <div className="brand-title">在线考试系统</div>
            <div className="brand-sub">Online Examination System</div>
          </div>
        </div>
        <div className="topbar-user">
          <div className="user-avatar" aria-hidden="true">
            {(user?.realName || user?.username || '?').slice(0, 1)}
          </div>
          <div className="user-meta">
            <span className="user-name">{user?.realName || user?.username}</span>
            <span className="user-account">{user?.username}</span>
          </div>
          <Badge tone={roleTone}>{ROLE_LABELS[user?.role] || user?.role}</Badge>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleLogout}>
            退出
          </button>
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          {sections.map((section) => (
            <div className="sidebar-section" key={section.title}>
              <div className="sidebar-section-title">{section.title}</div>
              <nav className="sidebar-nav">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  >
                    <span className="sidebar-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="sidebar-label">{item.label}</span>
                  </NavLink>
                ))}
              </nav>
            </div>
          ))}
          <div className="sidebar-footer">
            <span>Exam System</span>
            <span>v1.0</span>
          </div>
        </aside>

        <main className="main">
          <Outlet />
        </main>
      </div>
      {confirmNode}
    </div>
  );
}
