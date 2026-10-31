import { useState } from 'react';
import Modal from './Modal';
import FormField from './FormField';
import { createQuestion, updateQuestion } from '../api/questions';
import { DIFFICULTY_LABELS, OPTION_KEYS, TYPE_LABELS } from '../utils/format';
import { toast } from '../utils/toast';

const CHOICE_TYPES = ['single', 'multiple'];

function createOptions(count = 4) {
  return OPTION_KEYS.slice(0, count).map((key) => ({ key, text: '' }));
}

function buildInitial(question, defaultCourseId) {
  const type = question?.type || 'single';
  const options =
    Array.isArray(question?.options) && question.options.length >= 2
      ? question.options.map((option) => ({ key: option.key, text: option.text }))
      : createOptions(4);
  const keys = options.map((option) => option.key);
  let answer = 'A';
  if (type === 'multiple') {
    answer = Array.isArray(question?.answer) ? question.answer.filter((key) => keys.includes(key)).sort() : [];
  } else if (type === 'single') {
    answer = keys.includes(question?.answer) ? question.answer : keys[0];
  }
  return {
    courseId: question?.courseId ? String(question.courseId) : defaultCourseId ? String(defaultCourseId) : '',
    type,
    stem: question?.stem || '',
    options,
    answer,
    judgeAnswer: question?.type === 'judge' ? (question.answer === 'F' ? 'F' : 'T') : 'T',
    shortAnswer: type === 'short' ? String(question?.answer || '') : '',
    score: question?.score !== undefined && question?.score !== null ? String(question.score) : '',
    difficulty: String(question?.difficulty ?? 3),
    knowledgePoint: question?.knowledgePoint || '',
    analysis: question?.analysis || ''
  };
}

export default function QuestionFormModal({ question, courses, defaultCourseId, onClose, onSaved }) {
  const isEdit = Boolean(question);
  const [form, setForm] = useState(() => buildInitial(question, defaultCourseId));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleTypeChange = (type) => {
    setForm((prev) => {
      const next = { ...prev, type };
      if (CHOICE_TYPES.includes(type)) {
        if (!Array.isArray(prev.options) || prev.options.length < 2) next.options = createOptions(4);
        const keys = next.options.map((option) => option.key);
        if (type === 'single') {
          next.answer = keys.includes(prev.answer) ? prev.answer : keys[0];
        } else {
          next.answer = Array.isArray(prev.answer) ? prev.answer.filter((key) => keys.includes(key)) : [];
        }
      }
      return next;
    });
    setErrors((prev) => ({ ...prev, answer: undefined, options: undefined }));
  };

  const updateOptionText = (index, text) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((option, i) => (i === index ? { ...option, text } : option))
    }));
    setErrors((prev) => ({ ...prev, options: undefined }));
  };

  const addOption = () => {
    setForm((prev) => {
      if (prev.options.length >= OPTION_KEYS.length) return prev;
      return { ...prev, options: [...prev.options, { key: OPTION_KEYS[prev.options.length], text: '' }] };
    });
  };

  const removeOption = (index) => {
    setForm((prev) => {
      if (prev.options.length <= 2) return prev;
      const removed = prev.options[index];
      const options = prev.options
        .filter((_, i) => i !== index)
        .map((option, i) => ({ ...option, key: OPTION_KEYS[i] }));
      const keys = options.map((option) => option.key);
      let answer = prev.answer;
      if (prev.type === 'single') {
        if (prev.answer === removed.key) answer = keys[0];
        else {
          const oldIndex = prev.options.findIndex((option) => option.key === prev.answer);
          answer = oldIndex >= 0 ? OPTION_KEYS[oldIndex > index ? oldIndex - 1 : oldIndex] : keys[0];
        }
        if (!keys.includes(answer)) answer = keys[0];
      } else if (prev.type === 'multiple') {
        answer = (Array.isArray(prev.answer) ? prev.answer : [])
          .filter((key) => key !== removed.key)
          .map((key) => {
            const oldIndex = prev.options.findIndex((option) => option.key === key);
            if (oldIndex < 0) return null;
            return OPTION_KEYS[oldIndex > index ? oldIndex - 1 : oldIndex];
          })
          .filter((key) => key && keys.includes(key));
      }
      return { ...prev, options, answer };
    });
    setErrors((prev) => ({ ...prev, options: undefined, answer: undefined }));
  };

  const toggleMultiple = (key) => {
    setForm((prev) => {
      const list = Array.isArray(prev.answer) ? prev.answer : [];
      const next = list.includes(key) ? list.filter((item) => item !== key) : [...list, key];
      return { ...prev, answer: next.sort() };
    });
    setErrors((prev) => ({ ...prev, answer: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!form.courseId) next.courseId = '请选择所属课程';
    if (!form.stem.trim()) next.stem = '请输入题干';
    else if (form.stem.trim().length > 1000) next.stem = '题干不能超过 1000 个字符';

    const scoreText = String(form.score).trim();
    if (!scoreText) next.score = '请输入建议分值';
    else if (!/^\d+(\.\d{1,2})?$/.test(scoreText) || Number(scoreText) <= 0) {
      next.score = '分值必须大于 0，且最多两位小数';
    }

    if (CHOICE_TYPES.includes(form.type)) {
      if (form.options.length < 2) next.options = '选择题至少需要 2 个选项';
      else {
        for (const option of form.options) {
          if (!option.text.trim()) {
            next.options = `选项 ${option.key} 的内容不能为空`;
            break;
          }
          if (option.text.trim().length > 200) {
            next.options = `选项 ${option.key} 的内容不能超过 200 个字符`;
            break;
          }
        }
        const keys = form.options.map((option) => option.key);
        if (new Set(keys).size !== keys.length) next.options = '选项 key 不能重复';
      }
      const answerKeys = Array.isArray(form.answer) ? form.answer : form.answer ? [form.answer] : [];
      if (form.type === 'single') {
        if (answerKeys.length !== 1) next.answer = '请选择唯一正确答案';
        else if (!form.options.some((option) => option.key === form.answer)) next.answer = '答案必须存在于选项中';
      } else {
        if (answerKeys.length < 2) next.answer = '多选题答案至少选择 2 项';
        else if (answerKeys.some((key) => !form.options.some((option) => option.key === key))) {
          next.answer = '答案必须存在于选项中';
        }
      }
    }

    if (form.type === 'judge' && !['T', 'F'].includes(form.judgeAnswer)) next.answer = '请选择判断题答案';
    if (form.type === 'short') {
      if (!form.shortAnswer.trim()) next.answer = '请输入简答题参考答案';
      else if (form.shortAnswer.trim().length > 500) next.answer = '参考答案不能超过 500 个字符';
    }

    if (form.knowledgePoint.trim().length > 100) next.knowledgePoint = '知识点不能超过 100 个字符';
    if (form.analysis.trim().length > 1000) next.analysis = '解析不能超过 1000 个字符';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    const payload = {
      type: form.type,
      stem: form.stem.trim(),
      score: Number(form.score),
      difficulty: Number(form.difficulty)
    };
    if (CHOICE_TYPES.includes(form.type)) {
      payload.options = form.options.map((option) => ({ key: option.key, text: option.text.trim() }));
      payload.answer = form.type === 'multiple' ? [...form.answer].sort() : form.answer;
    } else if (form.type === 'judge') {
      payload.answer = form.judgeAnswer;
      if (isEdit) payload.options = null;
    } else {
      payload.answer = form.shortAnswer.trim();
      if (isEdit) payload.options = null;
    }
    payload.knowledgePoint = form.knowledgePoint.trim() || (isEdit ? null : undefined);
    payload.analysis = form.analysis.trim() || (isEdit ? null : undefined);
    if (isEdit) {
      // B13 不支持修改所属课程
    } else {
      payload.courseId = Number(form.courseId);
    }

    setSubmitting(true);
    setFormError('');
    try {
      if (isEdit) {
        await updateQuestion(question.id, payload);
        toast.success('题目已更新');
      } else {
        await createQuestion(payload);
        toast.success('题目创建成功');
      }
      onSaved();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const choice = CHOICE_TYPES.includes(form.type);
  const optionKeys = form.options.map((option) => option.key);

  return (
    <Modal
      open
      size="lg"
      title={isEdit ? '编辑题目' : '新增题目'}
      onClose={submitting ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            取消
          </button>
          <button type="submit" form="question-form" className="btn btn-primary" disabled={submitting}>
            {submitting ? '保存中…' : isEdit ? '保存修改' : '创建题目'}
          </button>
        </>
      }
    >
      <form id="question-form" className="form" onSubmit={handleSubmit} noValidate>
        {formError && <div className="alert alert-error">{formError}</div>}

        <div className="form-grid">
          <FormField label="所属课程" required htmlFor="question-course" error={errors.courseId}>
            <select
              id="question-course"
              className="select"
              value={form.courseId}
              disabled={isEdit}
              onChange={(event) => update('courseId', event.target.value)}
            >
              <option value="">请选择课程</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}（{course.code}）
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="题型" required htmlFor="question-type" error={errors.type} hint={isEdit ? '已被已发布试卷引用的题目不能改题型与答案' : ''}>
            <select id="question-type" className="select" value={form.type} onChange={(event) => handleTypeChange(event.target.value)}>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="建议分值" required htmlFor="question-score" error={errors.score}>
            <input
              id="question-score"
              className="input"
              type="number"
              min="0.01"
              step="0.01"
              value={form.score}
              onChange={(event) => update('score', event.target.value)}
              placeholder="如 5"
            />
          </FormField>
          <FormField label="难度" htmlFor="question-difficulty" error={errors.difficulty}>
            <select id="question-difficulty" className="select" value={form.difficulty} onChange={(event) => update('difficulty', event.target.value)}>
              {[1, 2, 3, 4, 5].map((level) => (
                <option key={level} value={level}>
                  {level} 星 · {DIFFICULTY_LABELS[level]}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="题干" required htmlFor="question-stem" error={errors.stem} className="form-field-span">
            <textarea
              id="question-stem"
              className="textarea"
              rows={3}
              maxLength={1000}
              value={form.stem}
              onChange={(event) => update('stem', event.target.value)}
              placeholder="请输入题干内容"
            />
            <div className="char-count">{form.stem.length} / 1000</div>
          </FormField>
        </div>

        {choice && (
          <FormField label="选项" required error={errors.options} hint="选项 key 固定为 A~F，至少 2 项、最多 6 项">
            <div className="option-editor">
              {form.options.map((option, index) => (
                <div className="option-row" key={option.key}>
                  <span className="option-key">{option.key}</span>
                  <input
                    className="input"
                    value={option.text}
                    maxLength={200}
                    placeholder={`选项 ${option.key} 内容`}
                    onChange={(event) => updateOptionText(index, event.target.value)}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    title="删除该选项"
                    onClick={() => removeOption(index)}
                    disabled={form.options.length <= 2}
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="option-actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={addOption} disabled={form.options.length >= OPTION_KEYS.length}>
                  + 添加选项
                </button>
              </div>
            </div>
          </FormField>
        )}

        <FormField
          label={form.type === 'short' ? '参考答案' : '正确答案'}
          required
          error={errors.answer}
          hint={form.type === 'multiple' ? '少选、错选、多选均不得分' : ''}
        >
          {form.type === 'single' && (
            <div className="option-answer-list">
              {form.options.map((option) => (
                <label key={option.key} className={`option-answer ${form.answer === option.key ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="single-answer"
                    checked={form.answer === option.key}
                    onChange={() => update('answer', option.key)}
                  />
                  <span className="option-answer-key">{option.key}</span>
                  <span>{option.text || '（未填写选项内容）'}</span>
                </label>
              ))}
            </div>
          )}

          {form.type === 'multiple' && (
            <div className="option-answer-list">
              {form.options.map((option) => (
                <label key={option.key} className={`option-answer ${form.answer.includes(option.key) ? 'active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={form.answer.includes(option.key)}
                    onChange={() => toggleMultiple(option.key)}
                  />
                  <span className="option-answer-key">{option.key}</span>
                  <span>{option.text || '（未填写选项内容）'}</span>
                </label>
              ))}
            </div>
          )}

          {form.type === 'judge' && (
            <div className="option-answer-list option-answer-inline">
              {[
                { key: 'T', label: '正确（T）' },
                { key: 'F', label: '错误（F）' }
              ].map((item) => (
                <label key={item.key} className={`option-answer ${form.judgeAnswer === item.key ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="judge-answer"
                    checked={form.judgeAnswer === item.key}
                    onChange={() => update('judgeAnswer', item.key)}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          )}

          {form.type === 'short' && (
            <>
              <textarea
                className="textarea"
                rows={3}
                maxLength={500}
                value={form.shortAnswer}
                onChange={(event) => update('shortAnswer', event.target.value)}
                placeholder="请输入参考答案（供教师阅卷参考）"
              />
              <div className="char-count">{form.shortAnswer.length} / 500</div>
            </>
          )}
        </FormField>

        <div className="form-grid">
          <FormField label="知识点" htmlFor="question-knowledge" error={errors.knowledgePoint}>
            <input
              id="question-knowledge"
              className="input"
              value={form.knowledgePoint}
              maxLength={100}
              onChange={(event) => update('knowledgePoint', event.target.value)}
              placeholder="选填，如：线性表"
            />
          </FormField>
          <FormField label="解析" htmlFor="question-analysis" error={errors.analysis} hint="学生交卷后可查看">
            <input
              id="question-analysis"
              className="input"
              value={form.analysis}
              maxLength={1000}
              onChange={(event) => update('analysis', event.target.value)}
              placeholder="选填"
            />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
