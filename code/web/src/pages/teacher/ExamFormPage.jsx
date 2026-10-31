import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createExam, getExam, updateExam } from '../../api/exams';
import { listCourses } from '../../api/courses';
import { listQuestions } from '../../api/questions';
import useConfirm from '../../hooks/useConfirm';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import FormField from '../../components/FormField';
import Loading from '../../components/Loading';
import {
  DIFFICULTY_LABELS,
  EXAM_STATUS_LABELS,
  TYPE_LABELS,
  TYPE_TONES,
  formatScore,
  fromDatetimeLocal,
  toDatetimeLocal,
  truncate
} from '../../utils/format';
import { toast } from '../../utils/toast';

const DEFAULT_FORM = {
  title: '',
  courseId: '',
  description: '',
  startTime: '',
  endTime: '',
  durationMin: '90',
  passScore: '60',
  shuffle: false
};

export default function ExamFormPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const editId = searchParams.get('id');
  const isEdit = Boolean(editId);

  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [selected, setSelected] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [picker, setPicker] = useState({ type: '', difficulty: '', keyword: '', page: 1, pageSize: 10 });
  const [keywordInput, setKeywordInput] = useState('');
  const [pickerData, setPickerData] = useState({ list: [], total: 0, page: 1, pageSize: 10 });
  const [pickerLoading, setPickerLoading] = useState(false);
  const { ask, confirmNode } = useConfirm();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError('');
    (async () => {
      try {
        const [courseList, detail] = await Promise.all([
          listCourses(),
          isEdit ? getExam(Number(editId)) : Promise.resolve(null)
        ]);
        if (!alive) return;
        const courseArray = Array.isArray(courseList) ? courseList : [];
        setCourses(courseArray);

        if (detail) {
          if (detail.status !== 'draft') {
            setLoadError(`仅草稿状态的考试可以编辑，该考试当前状态为「${EXAM_STATUS_LABELS[detail.status] || detail.status}」。`);
          }
          setForm({
            title: detail.title || '',
            courseId: String(detail.courseId || ''),
            description: detail.description || '',
            startTime: toDatetimeLocal(detail.startTime),
            endTime: toDatetimeLocal(detail.endTime),
            durationMin: String(detail.durationMin ?? 90),
            passScore: String(detail.passScore ?? 60),
            shuffle: Boolean(detail.shuffle)
          });
          setSelected(
            (detail.questions || []).map((question) => ({
              questionId: question.questionId,
              type: question.type,
              stem: question.stem,
              score: String(question.score ?? '')
            }))
          );
        } else {
          setForm((prev) => ({
            ...prev,
            courseId: courseArray.length === 1 ? String(courseArray[0].id) : ''
          }));
        }
      } catch (err) {
        if (alive) setLoadError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [editId, isEdit]);

  useEffect(() => {
    if (!form.courseId) {
      setPickerData({ list: [], total: 0, page: 1, pageSize: 10 });
      return undefined;
    }
    let alive = true;
    setPickerLoading(true);
    listQuestions({
      courseId: Number(form.courseId),
      type: picker.type || undefined,
      difficulty: picker.difficulty ? Number(picker.difficulty) : undefined,
      keyword: picker.keyword || undefined,
      page: picker.page,
      pageSize: picker.pageSize
    })
      .then((res) => {
        if (!alive) return;
        setPickerData(res || { list: [], total: 0, page: picker.page, pageSize: picker.pageSize });
      })
      .catch(() => {
        if (alive) setPickerData({ list: [], total: 0, page: picker.page, pageSize: picker.pageSize });
      })
      .finally(() => {
        if (alive) setPickerLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [form.courseId, picker.type, picker.difficulty, picker.keyword, picker.page, picker.pageSize]);

  const totalScore = useMemo(() => {
    const sum = selected.reduce((acc, item) => {
      const value = Number(item.score);
      return acc + (Number.isFinite(value) && value > 0 ? value : 0);
    }, 0);
    return Math.round(sum * 100) / 100;
  }, [selected]);

  const passScoreNumber = Number(form.passScore);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleCourseChange = (value) => {
    if (isEdit) return;
    if (!value) {
      setForm((prev) => ({ ...prev, courseId: '' }));
      setSelected([]);
      return;
    }
    if (selected.length > 0) {
      ask({
        title: '切换课程',
        message: '切换课程将清空已选题目，确定切换吗？',
        confirmText: '切换课程',
        danger: true,
        onConfirm: async () => {
          setSelected([]);
          setPicker((prev) => ({ ...prev, page: 1 }));
          setForm((prev) => ({ ...prev, courseId: value }));
        }
      });
      return;
    }
    setForm((prev) => ({ ...prev, courseId: value }));
    setPicker((prev) => ({ ...prev, page: 1 }));
  };

  const toggleQuestion = (question) => {
    setSelected((prev) => {
      const exists = prev.some((item) => item.questionId === question.id);
      if (exists) return prev.filter((item) => item.questionId !== question.id);
      return [
        ...prev,
        {
          questionId: question.id,
          type: question.type,
          stem: question.stem,
          score: question.score !== null && question.score !== undefined ? String(question.score) : ''
        }
      ];
    });
    setErrors((prev) => ({ ...prev, questions: undefined }));
  };

  const updateScore = (questionId, value) => {
    setSelected((prev) => prev.map((item) => (item.questionId === questionId ? { ...item, score: value } : item)));
    setErrors((prev) => ({ ...prev, questions: undefined }));
  };

  const removeSelected = (questionId) => {
    setSelected((prev) => prev.filter((item) => item.questionId !== questionId));
  };

  const moveSelected = (index, direction) => {
    setSelected((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const validate = () => {
    const next = {};
    if (!form.title.trim()) next.title = '请输入考试标题';
    else if (form.title.trim().length > 150) next.title = '考试标题不能超过 150 个字符';
    if (!form.courseId) next.courseId = '请选择所属课程';
    if (!form.startTime) next.startTime = '请选择开始时间';
    if (!form.endTime) next.endTime = '请选择结束时间';
    if (form.startTime && form.endTime && fromDatetimeLocal(form.startTime) >= fromDatetimeLocal(form.endTime)) {
      next.endTime = '结束时间必须晚于开始时间';
    }
    const duration = Number(form.durationMin);
    if (!Number.isInteger(duration) || duration < 1 || duration > 600) next.durationMin = '考试时长须为 1~600 的整数';
    if (form.passScore === '' || Number.isNaN(passScoreNumber) || passScoreNumber < 0) {
      next.passScore = '及格线须为非负数字';
    } else if (passScoreNumber > totalScore) {
      next.passScore = `及格线不能大于试卷总分（${formatScore(totalScore)}）`;
    }
    if (form.description.length > 500) next.description = '考试说明不能超过 500 个字符';
    if (selected.length === 0) next.questions = '请至少选择 1 道题目';
    else if (selected.some((item) => !item.score || Number(item.score) <= 0 || Number.isNaN(Number(item.score)))) {
      next.questions = '每道题的分值必须大于 0';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loadError) return;
    if (!validate()) {
      toast.error('请先修正表单中的错误');
      return;
    }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || (isEdit ? null : undefined),
      startTime: fromDatetimeLocal(form.startTime),
      endTime: fromDatetimeLocal(form.endTime),
      durationMin: Number(form.durationMin),
      passScore: Number(form.passScore),
      shuffle: Boolean(form.shuffle),
      questions: selected.map((item) => ({ questionId: item.questionId, score: Number(item.score) }))
    };
    if (!isEdit) payload.courseId = Number(form.courseId);

    setSubmitting(true);
    setFormError('');
    try {
      if (isEdit) {
        await updateExam(Number(editId), payload);
        toast.success('考试已保存');
      } else {
        await createExam(payload);
        toast.success('考试创建成功，可继续发布或指派考生');
      }
      navigate('/teacher/exams');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const pickerColumns = [
    {
      key: 'pick',
      title: '',
      width: 44,
      render: (row) => {
        const checked = selected.some((item) => item.questionId === row.id);
        return (
          <input
            type="checkbox"
            aria-label={`选择题目 ${row.id}`}
            checked={checked}
            onChange={() => toggleQuestion(row)}
          />
        );
      }
    },
    {
      key: 'type',
      title: '题型',
      width: 88,
      render: (row) => <Badge tone={TYPE_TONES[row.type]}>{TYPE_LABELS[row.type] || row.type}</Badge>
    },
    {
      key: 'stem',
      title: '题干',
      render: (row) => <span title={row.stem}>{truncate(row.stem, 52)}</span>
    },
    {
      key: 'score',
      title: '建议分',
      width: 70,
      align: 'right',
      render: (row) => formatScore(row.score)
    },
    {
      key: 'difficulty',
      title: '难度',
      width: 70,
      align: 'right',
      render: (row) => `${row.difficulty} 星`
    }
  ];

  if (loading) {
    return (
      <div className="page">
        <div className="card">
          <Loading text="正在加载考试数据…" />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title={isEdit ? '编辑考试（草稿）' : '新建考试 · 组卷'}
        description="填写考试基本信息，从题库勾选题目并逐题设定分值，系统实时计算总分。"
        actions={
          <>
            <Link className="btn btn-secondary" to="/teacher/exams">
              取消
            </Link>
            <button type="submit" form="exam-form" className="btn btn-primary" disabled={submitting || Boolean(loadError)}>
              {submitting ? '保存中…' : isEdit ? '保存修改' : '创建考试'}
            </button>
          </>
        }
      />

      {loadError && (
        <div className="alert alert-error">
          {loadError}
          <Link to="/teacher/exams" className="alert-link">
            返回考试列表
          </Link>
        </div>
      )}
      {courses.length === 0 && !loadError && (
        <div className="alert alert-warning">当前没有可用课程，请先在课程管理中创建课程并关联任课教师。</div>
      )}

      <form id="exam-form" className="form" onSubmit={handleSubmit} noValidate>
        {formError && <div className="alert alert-error">{formError}</div>}

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">基本信息</h3>
          </div>
          <div className="card-body">
            <div className="form-grid">
              <FormField label="考试标题" required htmlFor="exam-title" error={errors.title} className="form-field-span">
                <input
                  id="exam-title"
                  className="input"
                  value={form.title}
                  maxLength={150}
                  onChange={(event) => update('title', event.target.value)}
                  placeholder="如：数据结构期中考试"
                />
              </FormField>
              <FormField label="所属课程" required htmlFor="exam-course-select" error={errors.courseId}>
                <select
                  id="exam-course-select"
                  className="select"
                  value={form.courseId}
                  disabled={isEdit}
                  onChange={(event) => handleCourseChange(event.target.value)}
                >
                  <option value="">请选择课程</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}（{course.code}）
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="考试时长（分钟）" required htmlFor="exam-duration" error={errors.durationMin}>
                <input
                  id="exam-duration"
                  className="input"
                  type="number"
                  min="1"
                  max="600"
                  step="1"
                  value={form.durationMin}
                  onChange={(event) => update('durationMin', event.target.value)}
                />
              </FormField>
              <FormField label="开始时间" required htmlFor="exam-start" error={errors.startTime}>
                <input
                  id="exam-start"
                  className="input"
                  type="datetime-local"
                  step="60"
                  value={form.startTime}
                  onChange={(event) => update('startTime', event.target.value)}
                />
              </FormField>
              <FormField label="结束时间" required htmlFor="exam-end" error={errors.endTime}>
                <input
                  id="exam-end"
                  className="input"
                  type="datetime-local"
                  step="60"
                  value={form.endTime}
                  onChange={(event) => update('endTime', event.target.value)}
                />
              </FormField>
              <FormField
                label="及格线"
                required
                htmlFor="exam-pass"
                error={errors.passScore}
                hint={`当前试卷总分 ${formatScore(totalScore)} 分`}
              >
                <input
                  id="exam-pass"
                  className="input"
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.passScore}
                  onChange={(event) => update('passScore', event.target.value)}
                />
              </FormField>
              <FormField label="题目乱序" htmlFor="exam-shuffle" hint="开启后按答卷固定随机顺序展示">
                <label className="checkbox-row" htmlFor="exam-shuffle">
                  <input
                    id="exam-shuffle"
                    type="checkbox"
                    checked={form.shuffle}
                    onChange={(event) => update('shuffle', event.target.checked)}
                  />
                  <span>打乱题目顺序（按答卷固定种子）</span>
                </label>
              </FormField>
              <FormField label="考试说明" htmlFor="exam-description" error={errors.description} className="form-field-span">
                <textarea
                  id="exam-description"
                  className="textarea"
                  rows={2}
                  maxLength={500}
                  value={form.description}
                  onChange={(event) => update('description', event.target.value)}
                  placeholder="选填，如考试范围、注意事项"
                />
              </FormField>
            </div>
            {isEdit && (
              <div className="form-tip">编辑模式下不允许更换所属课程；已发布或已有答卷的考试不能修改试卷内容。</div>
            )}
          </div>
        </div>

        <div className="compose-grid">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">从题库选题</h3>
              <span className="card-hint">已选 {selected.length} 题</span>
            </div>
            <div className="card-body">
              {!form.courseId ? (
                <div className="muted">请先选择所属课程，再挑选题目。</div>
              ) : (
                <>
                  <div className="toolbar picker-filters">
                    <div className="toolbar-group">
                      <select
                        className="select"
                        aria-label="题型筛选"
                        value={picker.type}
                        onChange={(event) => setPicker((prev) => ({ ...prev, type: event.target.value, page: 1 }))}
                      >
                        <option value="">全部题型</option>
                        {Object.entries(TYPE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="toolbar-group">
                      <select
                        className="select"
                        aria-label="难度筛选"
                        value={picker.difficulty}
                        onChange={(event) => setPicker((prev) => ({ ...prev, difficulty: event.target.value, page: 1 }))}
                      >
                        <option value="">全部难度</option>
                        {[1, 2, 3, 4, 5].map((level) => (
                          <option key={level} value={level}>
                            {level} 星 · {DIFFICULTY_LABELS[level]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="toolbar-group toolbar-grow">
                      <input
                        className="input"
                        placeholder="按题干搜索"
                        value={keywordInput}
                        onChange={(event) => setKeywordInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            setPicker((prev) => ({ ...prev, keyword: keywordInput.trim(), page: 1 }));
                          }
                        }}
                      />
                    </div>
                    <div className="toolbar-actions">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setPicker((prev) => ({ ...prev, keyword: keywordInput.trim(), page: 1 }))}
                      >
                        搜索
                      </button>
                    </div>
                  </div>

                  <DataTable
                    columns={pickerColumns}
                    data={pickerData.list}
                    loading={pickerLoading}
                    emptyIcon="📝"
                    emptyTitle="该课程下没有符合条件的题目"
                    emptyDescription="请调整筛选条件，或先到题库管理中添加题目"
                    pagination={{
                      page: pickerData.page || picker.page,
                      pageSize: pickerData.pageSize || picker.pageSize,
                      total: pickerData.total || 0,
                      onPageChange: (page) => setPicker((prev) => ({ ...prev, page })),
                      onPageSizeChange: (pageSize) => setPicker((prev) => ({ ...prev, pageSize, page: 1 }))
                    }}
                  />
                </>
              )}
            </div>
          </div>

          <div className="card compose-summary">
            <div className="card-header">
              <h3 className="card-title">已选题目</h3>
              <span className="card-hint">按顺序展示</span>
            </div>
            <div className="card-body">
              {errors.questions && <div className="alert alert-error">{errors.questions}</div>}
              {selected.length === 0 ? (
                <div className="muted">还没有选择题目，请在左侧题库中勾选。</div>
              ) : (
                <ul className="selected-list">
                  {selected.map((item, index) => (
                    <li className="selected-item" key={item.questionId}>
                      <div className="selected-item-head">
                        <span className="selected-index">{index + 1}</span>
                        <Badge tone={TYPE_TONES[item.type]}>{TYPE_LABELS[item.type] || item.type}</Badge>
                        <span className="selected-stem" title={item.stem}>
                          {truncate(item.stem, 40)}
                        </span>
                      </div>
                      <div className="selected-item-foot">
                        <label className="selected-score">
                          分值
                          <input
                            className="input input-sm"
                            type="number"
                            min="0.01"
                            step="0.5"
                            value={item.score}
                            onChange={(event) => updateScore(item.questionId, event.target.value)}
                          />
                        </label>
                        <div className="selected-actions">
                          <button type="button" className="icon-btn" title="上移" onClick={() => moveSelected(index, -1)} disabled={index === 0}>
                            ↑
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            title="下移"
                            onClick={() => moveSelected(index, 1)}
                            disabled={index === selected.length - 1}
                          >
                            ↓
                          </button>
                          <button type="button" className="icon-btn danger" title="移除" onClick={() => removeSelected(item.questionId)}>
                            ×
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="summary-box">
                <div className="summary-row">
                  <span>题目数量</span>
                  <strong>{selected.length} 题</strong>
                </div>
                <div className="summary-row">
                  <span>试卷总分</span>
                  <strong className="summary-total">{formatScore(totalScore)} 分</strong>
                </div>
                <div className="summary-row">
                  <span>及格线</span>
                  <strong>{formatScore(form.passScore || 0)} 分</strong>
                </div>
                {passScoreNumber > totalScore && totalScore > 0 && (
                  <div className="alert alert-warning">及格线高于当前试卷总分，请调整分值或及格线。</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </form>
      {confirmNode}
    </div>
  );
}
