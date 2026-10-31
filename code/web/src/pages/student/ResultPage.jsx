import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { getResult } from '../../api/attempts';
import PageHeader from '../../components/PageHeader';
import Badge from '../../components/Badge';
import Loading from '../../components/Loading';
import EmptyState from '../../components/EmptyState';
import AnswerOptions from '../../components/AnswerOptions';
import {
  ATTEMPT_STATUS_LABELS,
  ATTEMPT_STATUS_TONES,
  TYPE_LABELS,
  TYPE_TONES,
  formatScore
} from '../../utils/format';

export default function ResultPage() {
  const { attemptId } = useParams();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const banner = location.state || null;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getResult(attemptId);
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="page">
        <div className="card">
          <Loading text="正在加载成绩…" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page">
        <div className="card">
          <EmptyState
            icon="⚠️"
            title="暂时无法查看成绩"
            description={error || '成绩数据不存在'}
            action={
              <div className="empty-actions">
                <Link className="btn btn-primary" to="/student/exams">
                  返回我的考试
                </Link>
                <Link className="btn btn-secondary" to="/student/scores">
                  我的成绩
                </Link>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="成绩与解析"
        description={data.examTitle}
        actions={
          <>
            <Link className="btn btn-secondary" to="/student/scores">
              我的成绩
            </Link>
            <Link className="btn btn-secondary" to="/student/exams">
              返回我的考试
            </Link>
          </>
        }
      />

      {banner?.justSubmitted && (
        <div className="alert alert-success">
          {banner.autoSubmitted
            ? '考试时间已到，系统已自动为你交卷。'
            : '交卷成功，答案已保存。'}
          {banner.summary?.subjectivePending > 0 &&
            ` 其中 ${banner.summary.subjectivePending} 道简答题待教师评阅，最终成绩以教师评分后为准。`}
        </div>
      )}

      {data.status === 'submitted' && (
        <div className="alert alert-warning">
          本卷仍有主观题待阅卷，当前总分为客观题得分，教师完成评分后总分会自动更新。
        </div>
      )}

      <div className="card result-hero">
        <div className={`score-hero ${data.passed ? 'passed' : 'failed'}`}>
          <div className="score-big">{formatScore(data.totalScore)}</div>
          <div className="score-full">满分 {formatScore(data.examTotalScore)} 分</div>
          <div className="score-pass">
            {data.passed ? '已及格' : '未及格'} · 及格线 {formatScore(data.passScore)} 分
          </div>
        </div>
        <div className="result-meta-grid">
          <div>
            <span>答卷状态</span>
            <Badge tone={ATTEMPT_STATUS_TONES[data.status]}>{ATTEMPT_STATUS_LABELS[data.status] || data.status}</Badge>
          </div>
          <div>
            <span>客观题得分</span>
            <strong>{formatScore(data.objectiveScore)} 分</strong>
          </div>
          <div>
            <span>主观题得分</span>
            <strong>{formatScore(data.subjectiveScore)} 分</strong>
          </div>
          <div>
            <span>开考时间</span>
            <strong>{data.startedAt || '—'}</strong>
          </div>
          <div>
            <span>交卷时间</span>
            <strong>{data.submittedAt || '—'}</strong>
          </div>
        </div>
      </div>

      <div className="result-list">
        {data.items.map((item, index) => {
          const isObjective = item.type !== 'short';
          const full = Number(item.fullScore) || 0;
          const score = Number(item.score) || 0;
          const correct = isObjective && score >= full;
          return (
            <div className={`card result-item ${correct ? 'is-correct' : ''}`} key={item.questionId}>
              <div className="result-item-head">
                <span className="question-index">第 {index + 1} 题</span>
                <Badge tone={TYPE_TONES[item.type]}>{TYPE_LABELS[item.type] || item.type}</Badge>
                <span className={`result-score ${correct ? 'text-success' : score > 0 ? 'text-warning' : 'text-danger'}`}>
                  {formatScore(score)} / {formatScore(full)} 分
                </span>
                {isObjective && (
                  <Badge tone={correct ? 'green' : 'red'}>{correct ? '答对' : '答错'}</Badge>
                )}
                {!isObjective && <Badge tone="orange">人工评分</Badge>}
              </div>
              <div className="question-stem">{item.stem}</div>

              <AnswerOptions
                type={item.type}
                options={item.options}
                correctAnswer={item.correctAnswer}
                studentAnswer={item.myAnswer}
              />

              {item.type === 'short' && (
                <div className="answer-compare">
                  <div className="compare-block">
                    <div className="compare-label">我的作答</div>
                    <div className="compare-text">{item.myAnswer || '（未作答）'}</div>
                  </div>
                  <div className="compare-block">
                    <div className="compare-label">参考答案</div>
                    <div className="compare-text">{item.correctAnswer || '（无参考答案）'}</div>
                  </div>
                </div>
              )}

              {item.comment && (
                <div className="analysis-box">
                  <strong>教师评语：</strong>
                  {item.comment}
                </div>
              )}

              {item.analysis ? (
                <div className="analysis-box">
                  <strong>解析：</strong>
                  {item.analysis}
                </div>
              ) : (
                <div className="analysis-box muted">暂无解析</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="page-back">
        <Link to="/student/scores">查看我的历史成绩 →</Link>
      </div>
    </div>
  );
}
