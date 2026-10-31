import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getExamStats, listExamStats } from '../../api/stats';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import Loading from '../../components/Loading';
import EmptyState from '../../components/EmptyState';
import ScoreBar from '../../components/ScoreBar';
import { EXAM_STATUS_LABELS, EXAM_STATUS_TONES, TYPE_LABELS, TYPE_TONES, formatScore, truncate } from '../../utils/format';

export default function StatsPage() {
  const [searchParams] = useSearchParams();
  const [exams, setExams] = useState([]);
  const [examId, setExamId] = useState(searchParams.get('examId') || '');
  const [detail, setDetail] = useState(null);
  const [loadingExams, setLoadingExams] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoadingExams(true);
    setError('');
    listExamStats()
      .then((list) => {
        if (!alive) return;
        const array = Array.isArray(list) ? list : [];
        setExams(array);
        setExamId((prev) => {
          if (prev) return prev;
          const preferred = array.find((item) => item.count > 0) || array[0];
          return preferred ? String(preferred.examId) : '';
        });
      })
      .catch((err) => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (alive) setLoadingExams(false);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (!examId) {
      setDetail(null);
      return undefined;
    }
    let alive = true;
    setLoadingDetail(true);
    setError('');
    getExamStats(Number(examId))
      .then((res) => {
        if (alive) setDetail(res);
      })
      .catch((err) => {
        if (alive) {
          setDetail(null);
          setError(err.message);
        }
      })
      .finally(() => {
        if (alive) setLoadingDetail(false);
      });
    return () => {
      alive = false;
    };
  }, [examId, reloadKey]);

  const selectedExam = useMemo(
    () => exams.find((exam) => String(exam.examId) === String(examId)) || null,
    [exams, examId]
  );

  const maxDistribution = detail ? Math.max(1, ...detail.distribution.map((item) => item.count)) : 1;

  const summaryColumns = [
    {
      key: 'title',
      title: '考试',
      render: (row) => (
        <div>
          <div className="cell-main">{row.title}</div>
          <div className="cell-sub">{row.courseName || '未关联课程'}</div>
        </div>
      )
    },
    {
      key: 'status',
      title: '状态',
      width: 100,
      render: (row) => <Badge tone={EXAM_STATUS_TONES[row.status]}>{EXAM_STATUS_LABELS[row.status] || row.status}</Badge>
    },
    { key: 'count', title: '参考人数', width: 100, align: 'right' },
    { key: 'avg', title: '平均分', width: 90, align: 'right', render: (row) => formatScore(row.avg) },
    { key: 'max', title: '最高分', width: 90, align: 'right', render: (row) => formatScore(row.max) },
    { key: 'min', title: '最低分', width: 90, align: 'right', render: (row) => formatScore(row.min) },
    {
      key: 'passRate',
      title: '及格率',
      width: 100,
      align: 'right',
      render: (row) => `${formatScore(row.passRate)}%`
    },
    {
      key: 'actions',
      title: '操作',
      width: 90,
      render: (row) => (
        <button type="button" className="link-btn" onClick={() => setExamId(String(row.examId))}>
          查看
        </button>
      )
    }
  ];

  const questionColumns = [
    { key: 'sortOrder', title: '题号', width: 70, render: (row, index) => index + 1 },
    {
      key: 'type',
      title: '题型',
      width: 100,
      render: (row) => <Badge tone={TYPE_TONES[row.type]}>{TYPE_LABELS[row.type] || row.type}</Badge>
    },
    {
      key: 'stem',
      title: '题干',
      render: (row) => <span title={row.stem}>{truncate(row.stem, 60)}</span>
    },
    {
      key: 'accuracy',
      title: '正确率 / 得分率',
      width: 240,
      render: (row) => (
        <ScoreBar
          value={row.accuracy}
          max={100}
          text={`${formatScore(row.accuracy)}%`}
          tone={row.accuracy >= 60 ? 'high' : row.accuracy >= 30 ? 'mid' : 'low'}
        />
      )
    },
    {
      key: 'avgScore',
      title: '平均得分',
      width: 100,
      align: 'right',
      render: (row) => formatScore(row.avgScore)
    }
  ];

  return (
    <div className="page">
      <PageHeader
        title="成绩统计"
        description="按考试场次分析平均分、最高/最低分、及格率、分数段分布与题目正确率。"
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => setReloadKey((key) => key + 1)} disabled={loadingExams || loadingDetail}>
            刷新数据
          </button>
        }
      />

      {error && <div className="alert alert-error">{error}</div>}

      {loadingExams ? (
        <div className="card">
          <Loading text="正在加载场次统计…" />
        </div>
      ) : exams.length === 0 ? (
        <div className="card">
          <EmptyState icon="📊" title="暂无可统计的考试" description="创建并发布考试、学生交卷后即可查看统计" />
        </div>
      ) : (
        <>
          <div className="card">
            <div className="toolbar">
              <div className="toolbar-group">
                <label className="toolbar-label" htmlFor="stats-exam">
                  考试场次
                </label>
                <select id="stats-exam" className="select" value={examId} onChange={(event) => setExamId(event.target.value)}>
                  {exams.map((exam) => (
                    <option key={exam.examId} value={exam.examId}>
                      {exam.title}（{exam.count} 人）
                    </option>
                  ))}
                </select>
              </div>
              {selectedExam && (
                <div className="toolbar-meta">
                  {selectedExam.courseName} · 卷面总分 {formatScore(selectedExam.totalScore)} · 及格线{' '}
                  {formatScore(selectedExam.passScore)}
                </div>
              )}
            </div>

            {loadingDetail ? (
              <Loading text="正在加载场次成绩…" />
            ) : !detail ? (
              <EmptyState icon="📊" title="暂无统计数据" description="请选择有答卷的考试场次" />
            ) : (
              <>
                <div className="stat-grid stat-grid-5">
                  <div className="stat-card stat-blue">
                    <div className="stat-label">参考人数</div>
                    <div className="stat-value">{detail.count}</div>
                    <div className="stat-hint">仅统计已交卷答卷</div>
                  </div>
                  <div className="stat-card stat-teal">
                    <div className="stat-label">平均分</div>
                    <div className="stat-value">{formatScore(detail.avg)}</div>
                    <div className="stat-hint">满分 {formatScore(selectedExam?.totalScore)}</div>
                  </div>
                  <div className="stat-card stat-green">
                    <div className="stat-label">最高分</div>
                    <div className="stat-value">{formatScore(detail.max)}</div>
                    <div className="stat-hint">本场最高成绩</div>
                  </div>
                  <div className="stat-card stat-orange">
                    <div className="stat-label">最低分</div>
                    <div className="stat-value">{formatScore(detail.min)}</div>
                    <div className="stat-hint">本场最低成绩</div>
                  </div>
                  <div className="stat-card stat-purple">
                    <div className="stat-label">及格率</div>
                    <div className="stat-value">{formatScore(detail.passRate)}%</div>
                    <div className="stat-hint">及格线 {formatScore(selectedExam?.passScore)}</div>
                  </div>
                </div>

                {detail.count === 0 && (
                  <div className="alert alert-info">该场考试暂无已交卷答卷，以下统计均为 0，等待学生交卷后刷新即可。</div>
                )}

                <div className="grid grid-2">
                  <div className="card">
                    <div className="card-header">
                      <h3 className="card-title">分数段分布</h3>
                      <span className="card-hint">按百分制折算</span>
                    </div>
                    <div className="card-body">
                      <div className="distribution-list">
                        {detail.distribution.map((item) => (
                          <ScoreBar
                            key={item.label}
                            label={item.label}
                            value={item.count}
                            max={maxDistribution}
                            text={`${item.count} 人`}
                            tone="high"
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header">
                      <h3 className="card-title">数据说明</h3>
                    </div>
                    <div className="card-body">
                      <ul className="info-list">
                        <li>参考人数只统计「待阅卷」与「已评分」状态的答卷。</li>
                        <li>分数段固定为 5 段：0~60、60~70、70~80、80~90、90~100（前四段左闭右开，末段闭合）。</li>
                        <li>题目正确率 = 该题平均得分 ÷ 该题本卷满分 × 100%；简答题按平均得分率计算。</li>
                        <li>客观题全对才得满分，多选少选、错选均不得分。</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">题目正确率</h3>
                    <span className="card-hint">共 {detail.questions.length} 题</span>
                  </div>
                  <DataTable
                    columns={questionColumns}
                    data={detail.questions}
                    rowKey="questionId"
                    emptyIcon="📝"
                    emptyTitle="暂无题目统计"
                  />
                </div>
              </>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">各场次统计摘要</h3>
              <span className="card-hint">点击「查看」切换上方详情</span>
            </div>
            <DataTable
              columns={summaryColumns}
              data={exams}
              rowKey="examId"
              loading={loadingExams}
              emptyIcon="📊"
              emptyTitle="暂无场次统计"
            />
          </div>
        </>
      )}
    </div>
  );
}
