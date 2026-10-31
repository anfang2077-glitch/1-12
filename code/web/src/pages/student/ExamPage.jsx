import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getPaper, startAttempt } from '../../api/exams';
import { getAttempt, saveAnswer, submitAttempt } from '../../api/attempts';
import Badge from '../../components/Badge';
import Loading from '../../components/Loading';
import EmptyState from '../../components/EmptyState';
import Countdown from '../../components/Countdown';
import ConfirmDialog from '../../components/ConfirmDialog';
import {
  TYPE_LABELS,
  TYPE_TONES,
  formatScore,
  timePart
} from '../../utils/format';

function normalizeSavedAnswer(question) {
  if (question.type === 'multiple') {
    return Array.isArray(question.savedAnswer) ? question.savedAnswer : [];
  }
  if (question.type === 'short') {
    return question.savedAnswer === null || question.savedAnswer === undefined ? '' : String(question.savedAnswer);
  }
  return question.savedAnswer === null || question.savedAnswer === undefined ? '' : question.savedAnswer;
}

export default function ExamPage() {
  const { examId } = useParams();
  const navigate = useNavigate();

  const [phase, setPhase] = useState('loading'); // loading | ready | active | error
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [attemptId, setAttemptId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deadline, setDeadline] = useState(null);
  const [deadlineLabel, setDeadlineLabel] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle');
  const [savedAt, setSavedAt] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [autoSubmitting, setAutoSubmitting] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);

  const answersRef = useRef({});
  const dirtyRef = useRef(new Set());
  const typeMapRef = useRef({});
  const attemptIdRef = useRef(null);
  const saveTimerRef = useRef(null);
  const flushSaveRef = useRef(null);
  const inflightRef = useRef(false);
  const pendingFlushRef = useRef(false);
  const submittingRef = useRef(false);
  const savedAtRef = useRef('');
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  // 按题型序列化作答，null 表示清空
  const serializeAnswer = (questionId, raw) => {
    const type = typeMapRef.current[questionId];
    if (type === 'multiple') {
      return Array.isArray(raw) ? [...raw].sort() : [];
    }
    if (type === 'short') {
      if (raw === undefined || raw === null) return null;
      const text = String(raw);
      return text.trim() === '' ? null : text;
    }
    return raw === undefined || raw === null || raw === '' ? null : raw;
  };

  const applyAttempt = useCallback(
    (data) => {
      if (data.status !== 'in_progress') {
        navigate(`/student/result/${data.attemptId}`, { replace: true });
        return;
      }
      const list = data.questions || [];
      const typeMap = {};
      const answerMap = {};
      list.forEach((question) => {
        typeMap[question.questionId] = question.type;
        answerMap[question.questionId] = normalizeSavedAnswer(question);
      });
      typeMapRef.current = typeMap;
      answersRef.current = answerMap;
      dirtyRef.current.clear();
      attemptIdRef.current = data.attemptId;
      setQuestions(list);
      setAnswers(answerMap);
      setAttemptId(data.attemptId);
      setCurrentIndex(0);
      setDeadline(Date.now() + Math.max(0, Number(data.remainingSeconds) || 0) * 1000);
      setDeadlineLabel(data.deadlineAt || '');
      setSavedAt(data.lastSavedAt || '');
      savedAtRef.current = data.lastSavedAt || '';
      setSaveStatus('idle');
      setPhase('active');
    },
    [navigate]
  );

  const initPaper = useCallback(async () => {
    setPhase('loading');
    setError('');
    setNotice('');
    try {
      const paper = await getPaper(examId);
      if (!aliveRef.current) return;
      setExam(paper.exam);
      setQuestions(paper.questions || []);
      if (paper.attempt && paper.attempt.status !== 'in_progress') {
        navigate(`/student/result/${paper.attempt.attemptId}`, { replace: true });
        return;
      }
      if (paper.attempt) {
        const data = await getAttempt(paper.attempt.attemptId);
        if (!aliveRef.current) return;
        applyAttempt(data);
      } else {
        setPhase('ready');
      }
    } catch (err) {
      if (!aliveRef.current) return;
      setError(err.message);
      setPhase('error');
    }
  }, [examId, navigate, applyAttempt]);

  useEffect(() => {
    initPaper();
  }, [initPaper]);

  const handleStart = async () => {
    setStarting(true);
    setError('');
    try {
      const started = await startAttempt(examId);
      const data = await getAttempt(started.attemptId);
      if (!aliveRef.current) return;
      applyAttempt(data);
      setNotice('考试已开始，答案会自动保存；倒计时结束将自动交卷。');
    } catch (err) {
      setError(err.message);
    } finally {
      if (aliveRef.current) setStarting(false);
    }
  };

  const flushSave = useCallback(async () => {
    if (submittingRef.current) return;
    if (!attemptIdRef.current || dirtyRef.current.size === 0) return;
    if (inflightRef.current) {
      pendingFlushRef.current = true;
      return;
    }
    inflightRef.current = true;
    setSaveStatus('saving');
    let batch = [];
    try {
      let guard = 0;
      while (dirtyRef.current.size > 0 && guard < 20) {
        guard += 1;
        batch = Array.from(dirtyRef.current);
        dirtyRef.current.clear();
        const snapshot = batch.map((questionId) => {
          const answer = serializeAnswer(questionId, answersRef.current[questionId]);
          return { questionId, answer, signature: JSON.stringify(answer) };
        });
        for (const item of snapshot) {
          const res = await saveAnswer(attemptIdRef.current, {
            questionId: item.questionId,
            answer: item.answer
          });
          batch = batch.filter((id) => id !== item.questionId);
          if (res && res.savedAt) {
            savedAtRef.current = res.savedAt;
            setSavedAt(res.savedAt);
          }
          const currentSignature = JSON.stringify(serializeAnswer(item.questionId, answersRef.current[item.questionId]));
          if (currentSignature !== item.signature) {
            dirtyRef.current.add(item.questionId);
          }
        }
      }
      if (dirtyRef.current.size === 0) setSaveStatus('saved');
    } catch (err) {
      batch.forEach((questionId) => dirtyRef.current.add(questionId));
      setSaveStatus('error');
    } finally {
      inflightRef.current = false;
      if (pendingFlushRef.current) {
        pendingFlushRef.current = false;
        if (dirtyRef.current.size > 0) {
          window.setTimeout(() => flushSaveRef.current?.(), 50);
        }
      }
    }
  }, []);

  useEffect(() => {
    flushSaveRef.current = flushSave;
  }, [flushSave]);

  const handleAnswerChange = (questionId, value) => {
    if (submittingRef.current) return;
    const next = { ...answersRef.current, [questionId]: value };
    answersRef.current = next;
    setAnswers(next);
    dirtyRef.current.add(questionId);
    setSaveStatus('saving');
    window.clearTimeout(saveTimerRef.current);
    // 防抖 400ms：连续输入只触发一次保存，切题时定时器仍会执行
    saveTimerRef.current = window.setTimeout(() => {
      flushSaveRef.current?.();
    }, 400);
  };

  const isAnswered = (question) => {
    const value = answers[question.questionId];
    if (question.type === 'multiple') return Array.isArray(value) && value.length > 0;
    if (question.type === 'short') return typeof value === 'string' && value.trim().length > 0;
    return value !== undefined && value !== null && value !== '';
  };

  const answeredCount = questions.filter(isAnswered).length;

  const doSubmit = useCallback(
    async (auto) => {
      if (!attemptIdRef.current || submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      setAutoSubmitting(Boolean(auto));
      setSubmitOpen(false);
      setNotice(auto ? '考试时间已到，系统正在自动交卷…' : '正在交卷…');
      window.clearTimeout(saveTimerRef.current);
      try {
        const pendingIds = Array.from(dirtyRef.current);
        dirtyRef.current.clear();
        for (const questionId of pendingIds) {
          try {
            await saveAnswer(attemptIdRef.current, {
              questionId,
              answer: serializeAnswer(questionId, answersRef.current[questionId])
            });
          } catch (err) {
            // 交卷前补存失败不阻塞交卷，服务端以已保存答案判分
          }
        }
        const result = await submitAttempt(attemptIdRef.current);
        setNotice('');
        navigate(`/student/result/${attemptIdRef.current}`, {
          replace: true,
          state: { justSubmitted: true, autoSubmitted: Boolean(auto), summary: result }
        });
      } catch (err) {
        submittingRef.current = false;
        setSubmitting(false);
        setAutoSubmitting(false);
        if (err.code === 40901) {
          navigate(`/student/result/${attemptIdRef.current}`, { replace: true });
          return;
        }
        setError(err.message);
        setNotice('');
      }
    },
    [navigate]
  );

  const handleExpire = useCallback(() => {
    if (submittingRef.current) return;
    doSubmit(true);
  }, [doSubmit]);

  const currentQuestion = questions[currentIndex];

  const renderAnswerInput = (question) => {
    const value = answers[question.questionId];
    if (question.type === 'single' || question.type === 'judge') {
      const options =
        question.type === 'judge'
          ? [
              { key: 'T', text: '正确' },
              { key: 'F', text: '错误' }
            ]
          : question.options || [];
      return (
        <div className="options">
          {options.map((option) => (
            <button
              type="button"
              key={option.key}
              className={`option-item ${value === option.key ? 'selected' : ''}`}
              onClick={() => handleAnswerChange(question.questionId, option.key)}
              disabled={submitting}
            >
              <span className="option-key">{option.key}</span>
              <span className="option-text">{option.text}</span>
            </button>
          ))}
        </div>
      );
    }

    if (question.type === 'multiple') {
      const selected = Array.isArray(value) ? value : [];
      return (
        <>
          <div className="options">
            {(question.options || []).map((option) => {
              const checked = selected.includes(option.key);
              return (
                <button
                  type="button"
                  key={option.key}
                  className={`option-item ${checked ? 'selected' : ''}`}
                  onClick={() => {
                    const next = checked ? selected.filter((key) => key !== option.key) : [...selected, option.key].sort();
                    handleAnswerChange(question.questionId, next);
                  }}
                  disabled={submitting}
                >
                  <span className="option-key">{option.key}</span>
                  <span className="option-text">{option.text}</span>
                  <span className="option-check">{checked ? '✓' : ''}</span>
                </button>
              );
            })}
          </div>
          <div className="question-tip">多选题：少选、错选、多选均不得分</div>
        </>
      );
    }

    return (
      <>
        <textarea
          className="textarea short-answer"
          rows={8}
          maxLength={500}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => handleAnswerChange(question.questionId, event.target.value)}
          disabled={submitting}
          placeholder="请输入你的答案（最多 500 字）"
        />
        <div className="char-count">{(typeof value === 'string' ? value.length : 0)} / 500</div>
      </>
    );
  };

  if (phase === 'loading') {
    return (
      <div className="page">
        <div className="card">
          <Loading text="正在加载试卷…" />
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="page">
        <div className="card">
          <EmptyState
            icon="⚠️"
            title="无法进入考试"
            description={error || '试卷加载失败，请稍后重试'}
            action={
              <div className="empty-actions">
                <button type="button" className="btn btn-primary" onClick={initPaper}>
                  重新加载
                </button>
                <Link className="btn btn-secondary" to="/student/exams">
                  返回我的考试
                </Link>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  if (phase === 'ready') {
    return (
      <div className="page">
        <div className="card exam-start">
          <h1 className="exam-start-title">{exam?.title}</h1>
          <div className="exam-start-sub">{exam?.courseName || '未关联课程'}</div>
          <div className="exam-start-grid">
            <div>
              <span>考试时长</span>
              <strong>{exam?.durationMin} 分钟</strong>
            </div>
            <div>
              <span>试卷总分</span>
              <strong>{formatScore(exam?.totalScore)} 分</strong>
            </div>
            <div>
              <span>及格线</span>
              <strong>{formatScore(exam?.passScore)} 分</strong>
            </div>
            <div>
              <span>题目数量</span>
              <strong>{questions.length} 题</strong>
            </div>
            <div>
              <span>考试时间窗</span>
              <strong>
                {exam?.startTime} 至 {exam?.endTime}
              </strong>
            </div>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="alert alert-warning">
            点击「开始考试」后计时立即开始且不可暂停；答题过程自动保存，倒计时结束将自动交卷。请确认网络稳定后再开始。
          </div>
          <button type="button" className="btn btn-primary btn-lg" onClick={handleStart} disabled={starting}>
            {starting ? '正在开考…' : '开始考试'}
          </button>
          <div className="exam-start-back">
            <Link to="/student/exams">← 返回我的考试</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page exam-page">
      <div className="exam-header">
        <div className="exam-header-main">
          <h1 className="exam-title">{exam?.title || '在线考试'}</h1>
          <div className="exam-meta">
            {exam?.courseName || '未关联课程'} · 共 {questions.length} 题 · 总分 {formatScore(exam?.totalScore)} 分
            {deadlineLabel && ` · 截止 ${deadlineLabel}`}
          </div>
        </div>
        <div className="exam-header-right">
          {deadline && <Countdown deadline={deadline} onExpire={handleExpire} />}
          <div className={`save-status ${saveStatus}`}>
            {saveStatus === 'saving' && (
              <>
                <span className="save-dot" aria-hidden="true" /> 保存中…
              </>
            )}
            {saveStatus === 'saved' && <>✓ 已保存 {timePart(savedAt)}</>}
            {saveStatus === 'error' && (
              <button type="button" className="link-btn danger" onClick={() => flushSave()}>
                保存失败，点击重试
              </button>
            )}
            {saveStatus === 'idle' && '答案将自动保存'}
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setSubmitOpen(true)} disabled={submitting}>
            {submitting ? '交卷中…' : '交卷'}
          </button>
        </div>
      </div>

      {notice && <div className={`alert ${autoSubmitting ? 'alert-warning' : 'alert-info'}`}>{notice}</div>}
      {error && submitting === false && <div className="alert alert-error">{error}</div>}

      <div className="exam-layout">
        <section className="exam-main">
          {currentQuestion ? (
            <div className="card question-card">
              <div className="question-head">
                <span className="question-index">第 {currentIndex + 1} 题</span>
                <Badge tone={TYPE_TONES[currentQuestion.type]}>
                  {TYPE_LABELS[currentQuestion.type] || currentQuestion.type}
                </Badge>
                <span className="question-score">{formatScore(currentQuestion.score)} 分</span>
                <span className={`question-state ${isAnswered(currentQuestion) ? 'is-answered' : ''}`}>
                  {isAnswered(currentQuestion) ? '已作答' : '未作答'}
                </span>
              </div>
              <div className="question-stem">{currentQuestion.stem}</div>
              {renderAnswerInput(currentQuestion)}
              <div className="question-nav-buttons">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
                  disabled={currentIndex === 0}
                >
                  上一题
                </button>
                <span className="muted">
                  {currentIndex + 1} / {questions.length}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCurrentIndex((index) => Math.min(questions.length - 1, index + 1))}
                  disabled={currentIndex >= questions.length - 1}
                >
                  下一题
                </button>
              </div>
            </div>
          ) : (
            <div className="card">
              <EmptyState icon="📝" title="试卷暂无题目" description="请联系监考教师确认试卷内容" />
            </div>
          )}
        </section>

        <aside className="exam-sidebar">
          <div className="card question-nav-card">
            <div className="question-nav-title">
              答题卡
              <span className="question-nav-progress">
                已答 {answeredCount} / {questions.length}
              </span>
            </div>
            <div className="question-nav-grid">
              {questions.map((question, index) => (
                <button
                  type="button"
                  key={question.questionId}
                  className={`nav-btn ${isAnswered(question) ? 'answered' : ''} ${index === currentIndex ? 'current' : ''}`}
                  onClick={() => setCurrentIndex(index)}
                  aria-label={`第 ${index + 1} 题`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <div className="nav-legend">
              <span>
                <i className="legend-dot answered" /> 已作答
              </span>
              <span>
                <i className="legend-dot" /> 未作答
              </span>
            </div>
            <button type="button" className="btn btn-primary btn-block" onClick={() => setSubmitOpen(true)} disabled={submitting}>
              交 卷
            </button>
            {deadline && <div className="nav-remaining">{deadlineLabel ? `截止 ${deadlineLabel}` : '答卷已开始计时'}</div>}
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={submitOpen}
        title="确认交卷"
        message={
          <>
            本场考试共 <strong>{questions.length}</strong> 题，已作答 <strong>{answeredCount}</strong> 题，
            未作答 <strong>{questions.length - answeredCount}</strong> 题。
            <br />
            交卷后不能修改答案，确定交卷吗？
          </>
        }
        confirmText="确认交卷"
        danger
        loading={submitting}
        onCancel={() => setSubmitOpen(false)}
        onConfirm={() => doSubmit(false)}
      />
    </div>
  );
}
