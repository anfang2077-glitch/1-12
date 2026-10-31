import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listAvailableExams } from '../../api/exams';
import PageHeader from '../../components/PageHeader';
import Badge from '../../components/Badge';
import EmptyState from '../../components/EmptyState';
import Loading from '../../components/Loading';
import {
  ATTEMPT_STATUS_LABELS,
  ATTEMPT_STATUS_TONES,
  formatRemaining,
  formatScore,
  parseServerTime
} from '../../utils/format';

export default function MyExamsPage() {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await listAvailableExams();
      setExams(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const renderAction = (exam) => {
    const start = parseServerTime(exam.startTime);
    const end = parseServerTime(exam.endTime);
    const now = Date.now();
    const notStarted = start ? now < start.getTime() : false;
    const ended = end ? now > end.getTime() : false;

    if (exam.attemptStatus === 'in_progress') {
      return (
        <button type="button" className="btn btn-primary" onClick={() => navigate(`/student/exam/${exam.id}`)}>
          继续答题
        </button>
      );
    }
    if (exam.attemptStatus === 'submitted' || exam.attemptStatus === 'graded') {
      return (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate(`/student/result/${exam.attemptId}`)}
        >
          查看成绩
        </button>
      );
    }
    if (notStarted) {
      return (
        <button type="button" className="btn btn-primary" disabled title={`考试将于 ${exam.startTime} 开始`}>
          未到开考时间
        </button>
      );
    }
    if (ended) {
      return (
        <button type="button" className="btn btn-primary" disabled title="考试时间已结束">
          考试已结束
        </button>
      );
    }
    return (
      <button type="button" className="btn btn-primary" onClick={() => navigate(`/student/exam/${exam.id}`)}>
        开始考试
      </button>
    );
  };

  return (
    <div className="page">
      <PageHeader
        title="我的考试"
        description="这里列出被指派且已发布的考试；开考后计时开始，答案自动保存。"
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => setReloadKey((key) => key + 1)} disabled={loading}>
            {loading ? '刷新中…' : '刷新'}
          </button>
        }
      />

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="card">
          <Loading text="正在加载考试列表…" />
        </div>
      ) : exams.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="🗓️"
            title="暂无被指派的考试"
            description="待教师发布考试并指派考生后，这里会显示可参加的考试"
          />
        </div>
      ) : (
        <div className="exam-card-grid">
          {exams.map((exam) => {
            const inProgress = exam.attemptStatus === 'in_progress';
            return (
              <article className="card exam-card" key={exam.id}>
                <div className="exam-card-head">
                  <h3 className="exam-card-title">{exam.title}</h3>
                  <Badge tone={ATTEMPT_STATUS_TONES[exam.attemptStatus] || 'gray'}>
                    {ATTEMPT_STATUS_LABELS[exam.attemptStatus] || exam.attemptStatus}
                  </Badge>
                </div>
                <div className="exam-card-course">{exam.courseName || '未关联课程'}</div>
                <dl className="exam-card-meta">
                  <div>
                    <dt>考试时间</dt>
                    <dd>
                      {exam.startTime}
                      <br />至 {exam.endTime}
                    </dd>
                  </div>
                  <div>
                    <dt>时长</dt>
                    <dd>{exam.durationMin} 分钟</dd>
                  </div>
                  <div>
                    <dt>总分 / 及格线</dt>
                    <dd>
                      {formatScore(exam.totalScore)} / {formatScore(exam.passScore)}
                    </dd>
                  </div>
                  <div>
                    <dt>我的得分</dt>
                    <dd>
                      {exam.totalScoreObtained !== null && exam.totalScoreObtained !== undefined
                        ? `${formatScore(exam.totalScoreObtained)} 分`
                        : '—'}
                    </dd>
                  </div>
                </dl>
                {inProgress && (
                  <div className="exam-card-remaining">
                    剩余时间 <strong>{formatRemaining(exam.remainingSeconds)}</strong>，请尽快完成作答
                  </div>
                )}
                <div className="exam-card-foot">{renderAction(exam)}</div>
              </article>
            );
          })}
        </div>
      )}

      <div className="alert alert-info">
        提示：若答到一半离开页面，可从「我的考试」点击「继续答题」恢复；答卷以服务端截止时间为准，超时将自动交卷。
      </div>

      <div className="page-back">
        <Link to="/student/scores">查看我的历史成绩 →</Link>
      </div>
    </div>
  );
}
