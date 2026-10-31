import { useCallback, useEffect, useState } from 'react';
import { getOverview } from '../../api/stats';
import PageHeader from '../../components/PageHeader';
import Loading from '../../components/Loading';
import EmptyState from '../../components/EmptyState';
import { formatScore } from '../../utils/format';

function BarChart({ title, hint, items }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <div className="card chart-card">
      <div className="card-header">
        <h3 className="card-title">{title}</h3>
        {hint && <span className="card-hint">{hint}</span>}
      </div>
      <div className="card-body">
        <div className="chart-list">
          {items.map((item) => (
            <div className="chart-row" key={item.label}>
              <span className="chart-label">{item.label}</span>
              <div className="chart-track">
                <div className={`chart-fill ${item.tone ? `is-${item.tone}` : ''}`} style={{ width: `${(item.value / max) * 100}%` }} />
              </div>
              <span className="chart-value">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getOverview();
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cards = data
    ? [
        { key: 'userCount', label: '用户总数', value: data.userCount, hint: `教师 ${data.teacherCount} · 学生 ${data.studentCount}`, tone: 'blue' },
        { key: 'teacherCount', label: '教师账号', value: data.teacherCount, hint: '可组卷与阅卷', tone: 'purple' },
        { key: 'studentCount', label: '学生账号', value: data.studentCount, hint: '可参加考试', tone: 'green' },
        { key: 'courseCount', label: '课程数', value: data.courseCount, hint: '覆盖课程建设', tone: 'teal' },
        { key: 'questionCount', label: '题库题目', value: data.questionCount, hint: '四种题型', tone: 'orange' },
        { key: 'examCount', label: '考试场次', value: data.examCount, hint: '含草稿与已发布', tone: 'blue' },
        { key: 'attemptCount', label: '答卷记录', value: data.attemptCount, hint: '含进行中答卷', tone: 'purple' }
      ]
    : [];

  const adminCount = data ? Math.max(0, data.userCount - data.teacherCount - data.studentCount) : 0;
  const userItems = data
    ? [
        { label: '管理员', value: adminCount, tone: 'purple' },
        { label: '教师', value: data.teacherCount, tone: 'blue' },
        { label: '学生', value: data.studentCount, tone: 'green' }
      ]
    : [];
  const resourceItems = data
    ? [
        { label: '课程', value: data.courseCount, tone: 'teal' },
        { label: '题目', value: data.questionCount, tone: 'orange' },
        { label: '考试', value: data.examCount, tone: 'blue' },
        { label: '答卷', value: data.attemptCount, tone: 'purple' }
      ]
    : [];

  return (
    <div className="page">
      <PageHeader
        title="全局概览"
        description="系统整体规模与用户构成，数据实时取自服务端统计接口。"
        actions={
          <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
            {loading ? '刷新中…' : '刷新数据'}
          </button>
        }
      />

      {error && !data ? (
        <div className="card">
          <EmptyState
            icon="⚠️"
            title="概览数据加载失败"
            description={error}
            action={
              <button type="button" className="btn btn-primary" onClick={load}>
                重新加载
              </button>
            }
          />
        </div>
      ) : loading && !data ? (
        <div className="card">
          <Loading text="正在加载全局概览…" />
        </div>
      ) : (
        <>
          <div className="stat-grid">
            {cards.map((card) => (
              <div className={`stat-card stat-${card.tone}`} key={card.key}>
                <div className="stat-label">{card.label}</div>
                <div className="stat-value">{formatScore(card.value)}</div>
                <div className="stat-hint">{card.hint}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-2">
            <BarChart title="用户构成" hint="按角色统计" items={userItems} />
            <BarChart title="资源规模" hint="课程 / 题目 / 考试 / 答卷" items={resourceItems} />
          </div>

          <div className="alert alert-info">
            说明：用户总数包含管理员账号；答卷记录包含进行中、待阅卷与已评分三种状态；全部数据来源于
            <code>GET /api/stats/overview</code>。
          </div>
        </>
      )}
    </div>
  );
}
