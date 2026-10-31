import { useCallback, useEffect, useState } from 'react';
import { getGradingDetail, listPending, submitGrading } from '../../api/grading';
import { listExams } from '../../api/exams';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import Badge from '../../components/Badge';
import Loading from '../../components/Loading';
import AnswerOptions from '../../components/AnswerOptions';
import { ATTEMPT_STATUS_LABELS, ATTEMPT_STATUS_TONES, TYPE_LABELS, TYPE_TONES, formatScore } from '../../utils/format';
import { toast } from '../../utils/toast';

function GradingForm({ detail, onClose, onSaved }) {
  const shortItems = detail.items.filter((item) => item.type === 'short');
  const [scores, setScores] = useState(() => {
    const initial = {};
    shortItems.forEach((item) => {
      initial[item.questionId] = item.needGrading ? '' : String(item.score ?? '');
    });
    return initial;
  });
  const [comments, setComments] = useState(() => {
    const initial = {};
    shortItems.forEach((item) => {
      initial[item.questionId] = item.comment || '';
    });
    return initial;
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const next = {};
    shortItems.forEach((item) => {
      const raw = String(scores[item.questionId] ?? '').trim();
      if (!raw) {
        next[item.questionId] = '请输入得分';
        return;
      }
      if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
        next[item.questionId] = '得分最多保留两位小数';
        return;
      }
      const value = Number(raw);
      if (value < 0 || value > Number(item.fullScore)) {
        next[item.questionId] = `得分须在 0~${formatScore(item.fullScore)} 之间`;
      }
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setFormError('');
    try {
      const items = shortItems.map((item) => ({
        questionId: item.questionId,
        score: Number(scores[item.questionId]),
        comment: (comments[item.questionId] || '').trim() || undefined
      }));
      const res = await submitGrading(detail.attemptId, items);
      toast.success(`评分已保存，当前总分 ${formatScore(res?.totalScore)} 分`);
      onSaved();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      size="xl"
      title={`阅卷 · ${detail.studentName} · ${detail.examTitle}`}
      onClose={submitting ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            取消
          </button>
          <button type="submit" form="grading-form" className="btn btn-primary" disabled={submitting || shortItems.length === 0}>
            {submitting ? '提交中…' : '提交评分'}
          </button>
        </>
      }
    >
      <form id="grading-form" className="form" onSubmit={handleSubmit} noValidate>
        {formError && <div className="alert alert-error">{formError}</div>}

        <div className="grading-summary">
          <div className="grading-summary-item">
            <span>状态</span>
            <Badge tone={ATTEMPT_STATUS_TONES[detail.status]}>{ATTEMPT_STATUS_LABELS[detail.status] || detail.status}</Badge>
          </div>
          <div className="grading-summary-item">
            <span>交卷时间</span>
            <strong>{detail.submittedAt || '—'}</strong>
          </div>
          <div className="grading-summary-item">
            <span>客观题</span>
            <strong>{formatScore(detail.objectiveScore)} 分</strong>
          </div>
          <div className="grading-summary-item">
            <span>主观题</span>
            <strong>{formatScore(detail.subjectiveScore)} 分</strong>
          </div>
          <div className="grading-summary-item">
            <span>当前总分</span>
            <strong>{formatScore(detail.totalScore)} 分</strong>
          </div>
          <div className="grading-summary-item">
            <span>待评简答</span>
            <strong>{detail.pendingCount ?? shortItems.length} 题</strong>
          </div>
        </div>

        {detail.items.map((item, index) => (
          <div className={`grading-item ${item.needGrading ? 'needs-grading' : ''}`} key={item.questionId}>
            <div className="grading-item-head">
              <span className="question-index">{index + 1}</span>
              <Badge tone={TYPE_TONES[item.type]}>{TYPE_LABELS[item.type] || item.type}</Badge>
              <span className="grading-item-score">
                {formatScore(item.score)} / {formatScore(item.fullScore)} 分
              </span>
              {item.needGrading && <Badge tone="orange">待评分</Badge>}
            </div>
            <div className="grading-stem">{item.stem}</div>
            <AnswerOptions
              type={item.type}
              options={item.options}
              correctAnswer={item.correctAnswer}
              studentAnswer={item.studentAnswer}
            />

            {item.type !== 'short' && <div className="grading-auto">客观题已由系统自动判分，无需人工评分。</div>}

            {item.type === 'short' && (
              <div className="short-grading">
                <div className="answer-compare">
                  <div className="compare-block">
                    <div className="compare-label">学生作答</div>
                    <div className="compare-text">{item.studentAnswer || '（未作答）'}</div>
                  </div>
                  <div className="compare-block">
                    <div className="compare-label">参考答案</div>
                    <div className="compare-text">{item.correctAnswer || '（无参考答案）'}</div>
                  </div>
                </div>
                <div className="grading-form">
                  <FormField
                    label={`本题得分（满分 ${formatScore(item.fullScore)}）`}
                    required
                    htmlFor={`score-${item.questionId}`}
                    error={errors[item.questionId]}
                  >
                    <input
                      id={`score-${item.questionId}`}
                      className="input"
                      type="number"
                      min="0"
                      max={item.fullScore}
                      step="0.5"
                      value={scores[item.questionId]}
                      onChange={(event) => {
                        setScores((prev) => ({ ...prev, [item.questionId]: event.target.value }));
                        setErrors((prev) => ({ ...prev, [item.questionId]: undefined }));
                      }}
                    />
                  </FormField>
                  <FormField label="评语" htmlFor={`comment-${item.questionId}`} hint="选填，学生可在成绩解析中看到">
                    <textarea
                      id={`comment-${item.questionId}`}
                      className="textarea"
                      rows={2}
                      maxLength={500}
                      value={comments[item.questionId]}
                      onChange={(event) => setComments((prev) => ({ ...prev, [item.questionId]: event.target.value }))}
                    />
                  </FormField>
                </div>
              </div>
            )}
          </div>
        ))}
      </form>
    </Modal>
  );
}

export default function GradingPage() {
  const [pending, setPending] = useState([]);
  const [exams, setExams] = useState([]);
  const [examId, setExamId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeAttemptId, setActiveAttemptId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await listPending(examId ? { examId: Number(examId) } : undefined);
      setPending(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  useEffect(() => {
    let alive = true;
    listExams()
      .then((list) => {
        if (alive) setExams(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!activeAttemptId) {
      setDetail(null);
      return undefined;
    }
    let alive = true;
    setDetailLoading(true);
    getGradingDetail(activeAttemptId)
      .then((res) => {
        if (alive) setDetail(res);
      })
      .catch(() => {
        if (alive) setActiveAttemptId(null);
      })
      .finally(() => {
        if (alive) setDetailLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [activeAttemptId]);

  const columns = [
    { key: 'studentName', title: '学生', width: 140, render: (row) => <span className="cell-main">{row.studentName}</span> },
    {
      key: 'exam',
      title: '考试',
      render: (row) => {
        const exam = exams.find((item) => item.id === Number(examId));
        return exam ? exam.title : <span className="muted">全部考试</span>;
      }
    },
    { key: 'submittedAt', title: '交卷时间', width: 180, render: (row) => <span className="muted">{row.submittedAt}</span> },
    {
      key: 'pendingCount',
      title: '待评简答题',
      width: 120,
      align: 'right',
      render: (row) => <Badge tone="orange">{row.pendingCount} 题</Badge>
    },
    {
      key: 'actions',
      title: '操作',
      width: 120,
      render: (row) => (
        <button type="button" className="link-btn" onClick={() => setActiveAttemptId(row.attemptId)}>
          开始阅卷
        </button>
      )
    }
  ];

  return (
    <div className="page">
      <PageHeader
        title="阅卷中心"
        description={`待阅答卷 ${pending.length} 份 · 简答题需人工评分，提交后系统自动重算总分。`}
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => setReloadKey((key) => key + 1)} disabled={loading}>
            {loading ? '刷新中…' : '刷新'}
          </button>
        }
      />

      <div className="card">
        <div className="toolbar">
          <div className="toolbar-group">
            <label className="toolbar-label" htmlFor="grading-exam">
              考试
            </label>
            <select id="grading-exam" className="select" value={examId} onChange={(event) => setExamId(event.target.value)}>
              <option value="">全部考试</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <DataTable
          columns={columns}
          data={pending}
          rowKey="attemptId"
          loading={loading}
          emptyIcon="✅"
          emptyTitle="没有待阅答卷"
          emptyDescription="所有简答题都已评分，或暂未有人交卷"
        />
      </div>

      <div className="alert alert-info">
        提示：仅简答题需要人工评分；分数不能超过该题本卷满分。提交评分后答卷状态变为「已评分」，学生可查看成绩与解析。
      </div>

      {activeAttemptId &&
        (detailLoading || !detail ? (
          <Modal open title="阅卷详情" onClose={() => setActiveAttemptId(null)} size="lg" closeOnOverlay={false}>
            <Loading text="正在加载答卷…" />
          </Modal>
        ) : (
          <GradingForm
            detail={detail}
            onClose={() => setActiveAttemptId(null)}
            onSaved={() => {
              setActiveAttemptId(null);
              setReloadKey((key) => key + 1);
            }}
          />
        ))}
    </div>
  );
}
