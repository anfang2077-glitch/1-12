import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getStudentStats } from '../../api/stats';
import { useAuth } from '../../contexts/AuthContext';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import Loading from '../../components/Loading';
import { ATTEMPT_STATUS_LABELS, ATTEMPT_STATUS_TONES, formatScore } from '../../utils/format';

export default function ScoresPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    try {
      const res = await getStudentStats(user.id);
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = [
    {
      key: 'examTitle',
      title: '考试',
      render: (row) => (
        <div>
          <div className="cell-main">{row.examTitle}</div>
          <div className="cell-sub">考试编号 #{row.examId}</div>
        </div>
      )
    },
    {
      key: 'submittedAt',
      title: '交卷时间',
      width: 180,
      render: (row) => <span className="muted">{row.submittedAt || '—'}</span>
    },
    {
      key: 'totalScore',
      title: '得分',
      width: 110,
      align: 'right',
      render: (row) => (
        <strong>
          {formatScore(row.totalScore)}
          <span className="muted"> / {formatScore(row.fullScore)}</span>
        </strong>
      )
    },
    {
      key: 'passScore',
      title: '及格线',
      width: 90,
      align: 'right',
      render: (row) => formatScore(row.passScore)
    },
    {
      key: 'result',
      title: '结果',
      width: 90,
      render: (row) => {
        const passed = Number(row.totalScore) >= Number(row.passScore);
        if (row.status === 'submitted') return <Badge tone="orange">待阅卷</Badge>;
        return <Badge tone={passed ? 'green' : 'red'}>{passed ? '及格' : '未及格'}</Badge>;
      }
    },
    {
      key: 'status',
      title: '状态',
      width: 100,
      render: (row) => <Badge tone={ATTEMPT_STATUS_TONES[row.status]}>{ATTEMPT_STATUS_LABELS[row.status] || row.status}</Badge>
    },
    {
      key: 'actions',
      title: '操作',
      width: 100,
      render: (row) => (
        <Link className="link-btn" to={`/student/result/${row.attemptId}`}>
          查看解析
        </Link>
      )
    }
  ];

  return (
    <div className="page">
      <PageHeader
        title="我的成绩"
        description="历次已交卷考试的成绩汇总；主观题待阅卷时分数可能随后更新。"
        actions={
          <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
            {loading ? '刷新中…' : '刷新'}
          </button>
        }
      />

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="card">
          <Loading text="正在加载成绩…" />
        </div>
      ) : (
        <>
          <div className="stat-grid stat-grid-2">
            <div className="stat-card stat-blue">
              <div className="stat-label">已交卷考试</div>
              <div className="stat-value">{data?.count ?? 0}</div>
              <div className="stat-hint">仅统计已交卷的答卷</div>
            </div>
            <div className="stat-card stat-green">
              <div className="stat-label">平均分</div>
              <div className="stat-value">{formatScore(data?.avg ?? 0)}</div>
              <div className="stat-hint">{data?.studentName ? `${data.studentName} 的历次平均` : '历次考试平均'}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">成绩明细</h3>
              <span className="card-hint">按交卷时间倒序</span>
            </div>
            <DataTable
              columns={columns}
              data={data?.list || []}
              rowKey="attemptId"
              loading={false}
              emptyIcon="🏅"
              emptyTitle="还没有成绩记录"
              emptyDescription="参加考试并交卷后，成绩会显示在这里"
              emptyAction={
                <Link className="btn btn-primary" to="/student/exams">
                  去参加考试
                </Link>
              }
            />
          </div>

          {data && (data.list || []).length === 0 && (
            <div className="muted">提示：仅统计已交卷的答卷，进行中的考试不会出现在此处。</div>
          )}
        </>
      )}
    </div>
  );
}
