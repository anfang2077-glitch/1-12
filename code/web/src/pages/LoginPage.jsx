import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import FormField from '../components/FormField';
import Loading from '../components/Loading';
import Badge from '../components/Badge';
import { homePath, ROLE_LABELS } from '../utils/format';
import { toast } from '../utils/toast';

const DEMO_ACCOUNTS = [
  { role: 'admin', username: 'admin', password: 'Admin@123', name: '系统管理员', tone: 'purple' },
  { role: 'teacher', username: 'teacher01', password: 'Teach@123', name: '张老师', tone: 'blue' },
  { role: 'student', username: 'student01', password: 'Stu@123', name: '李小明', tone: 'green' }
];

function safeRedirect(redirect, role) {
  if (redirect && redirect.startsWith('/') && !redirect.startsWith('//') && redirect !== '/login') {
    return redirect;
  }
  return homePath(role);
}

export default function LoginPage() {
  const { user, booting, login } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (booting) return <Loading full text="正在校验登录状态…" />;
  if (user) return <Navigate to={homePath(user.role)} replace />;

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setError('');
  };

  const fillDemo = (account) => {
    setForm({ username: account.username, password: account.password });
    setErrors({});
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!form.username.trim()) nextErrors.username = '请输入用户名';
    if (!form.password) nextErrors.password = '请输入密码';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    setError('');
    try {
      const logged = await login(form.username.trim(), form.password);
      toast.success(`欢迎回来，${logged.realName || logged.username}`);
      navigate(safeRedirect(searchParams.get('redirect'), logged.role), { replace: true });
    } catch (err) {
      setError(err.message || '登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-shell">
        <section className="login-brand">
          <div className="login-logo">考</div>
          <h1 className="login-brand-title">在线考试系统</h1>
          <p className="login-brand-desc">
            面向课程教学全流程的在线考试平台，覆盖建课、建题库、组卷、发布、答题、阅卷与成绩分析。
          </p>
          <ul className="login-features">
            <li>三种角色分权：管理员 / 教师 / 学生</li>
            <li>答题自动保存、服务端倒计时、超时自动交卷</li>
            <li>客观题自动判分 + 主观题人工阅卷</li>
            <li>平均分、及格率、分数段分布与题目正确率</li>
          </ul>
          <div className="login-demo">
            <div className="login-demo-title">演示账号（点击自动填充）</div>
            <div className="demo-list">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  type="button"
                  className="demo-account"
                  key={account.username}
                  onClick={() => fillDemo(account)}
                >
                  <span className="demo-account-main">
                    <Badge tone={account.tone}>{ROLE_LABELS[account.role]}</Badge>
                    <span className="demo-name">{account.name}</span>
                  </span>
                  <span className="demo-account-sub">
                    {account.username} / {account.password}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="login-brand-foot">毕业设计项目 · Exam System v1.0</div>
        </section>

        <section className="login-panel">
          <h2 className="login-title">账号登录</h2>
          <p className="login-sub">请输入学号 / 工号与密码进入系统</p>

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <FormField label="用户名" required htmlFor="login-username" error={errors.username}>
              <input
                id="login-username"
                className="input"
                type="text"
                placeholder="请输入用户名"
                autoComplete="username"
                maxLength={50}
                value={form.username}
                onChange={(event) => update('username', event.target.value)}
              />
            </FormField>
            <FormField label="密码" required htmlFor="login-password" error={errors.password}>
              <input
                id="login-password"
                className="input"
                type="password"
                placeholder="请输入密码"
                autoComplete="current-password"
                maxLength={100}
                value={form.password}
                onChange={(event) => update('password', event.target.value)}
              />
            </FormField>
            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
              {loading ? '登录中…' : '登 录'}
            </button>
          </form>

          <div className="login-hint">
            角色权限：学生参加考试、查看成绩；教师组卷与阅卷；管理员管理用户与课程。
          </div>
        </section>
      </div>
    </div>
  );
}
