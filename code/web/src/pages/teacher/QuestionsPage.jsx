import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteQuestion, importQuestions, listQuestions } from '../../api/questions';
import { listCourses } from '../../api/courses';
import useConfirm from '../../hooks/useConfirm';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import QuestionFormModal from '../../components/QuestionFormModal';
import { DIFFICULTY_LABELS, TYPE_LABELS, TYPE_TONES, truncate } from '../../utils/format';
import { toast } from '../../utils/toast';

const IMPORT_EXAMPLE = `[
  {
    "type": "single",
    "stem": "栈的存取特点是？",
    "options": [
      { "key": "A", "text": "先进先出" },
      { "key": "B", "text": "后进先出" }
    ],
    "answer": "B",
    "score": 4,
    "difficulty": 2,
    "knowledgePoint": "栈与队列",
    "analysis": "栈是后进先出的线性表。"
  },
  {
    "type": "judge",
    "stem": "队列是先进先出的线性表。",
    "answer": "T",
    "score": 3,
    "difficulty": 1
  }
]`;

function ImportQuestionsModal({ courses, defaultCourseId, onClose, onImported }) {
  const [courseId, setCourseId] = useState(defaultCourseId ? String(defaultCourseId) : courses[0] ? String(courses[0].id) : '');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setResult(null);
    if (!courseId) {
      setError('请选择要导入的课程');
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      setError(`JSON 解析失败：${err.message}`);
      return;
    }
    const list = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.questions) ? parsed.questions : null;
    if (!list) {
      setError('JSON 结构不正确：应为题目数组，或包含 questions 数组的对象');
      return;
    }
    if (list.length === 0) {
      setError('题目列表不能为空');
      return;
    }
    if (list.length > 500) {
      setError('单次最多导入 500 道题');
      return;
    }

    setSubmitting(true);
    try {
      const res = await importQuestions({ courseId: Number(courseId), questions: list });
      setResult(res);
      if (res.imported > 0) {
        toast.success(`成功导入 ${res.imported} 道题目`);
        onImported();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      size="lg"
      title="批量导入题目"
      onClose={submitting ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            关闭
          </button>
          <button type="submit" form="import-question-form" className="btn btn-primary" disabled={submitting}>
            {submitting ? '导入中…' : '解析并导入'}
          </button>
        </>
      }
    >
      <form id="import-question-form" className="form" onSubmit={handleSubmit} noValidate>
        {error && <div className="alert alert-error">{error}</div>}

        <FormField label="导入到课程" required htmlFor="import-course">
          <select id="import-course" className="select" value={courseId} onChange={(event) => setCourseId(event.target.value)}>
            <option value="">请选择课程</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}（{course.code}）
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          label="题目 JSON"
          required
          htmlFor="import-json"
          hint="支持题目数组，或 { questions: [...] }；单次 1~500 道，字段与新增题目一致（无需 courseId）"
        >
          <textarea
            id="import-json"
            className="textarea code-textarea"
            rows={12}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={IMPORT_EXAMPLE}
            spellCheck={false}
          />
        </FormField>

        <div className="toolbar-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setText(IMPORT_EXAMPLE)} disabled={submitting}>
            填入示例
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setText('')} disabled={submitting || !text}>
            清空
          </button>
        </div>

        {result && (
          <div className="import-result">
            <div className={`alert ${result.imported > 0 ? 'alert-success' : 'alert-warning'}`}>
              导入完成：成功 <strong>{result.imported}</strong> 道，失败 <strong>{result.failed?.length || 0}</strong> 道。
            </div>
            {result.failed && result.failed.length > 0 && (
              <div className="import-failed">
                <div className="import-failed-title">失败明细（序号从 1 开始）</div>
                <ul>
                  {result.failed.map((item) => (
                    <li key={`${item.index}-${item.reason}`}>
                      第 {item.index + 1} 道：{item.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}

export default function QuestionsPage() {
  const [courses, setCourses] = useState([]);
  const [filters, setFilters] = useState({ courseId: '', type: '', difficulty: '', keyword: '', page: 1, pageSize: 10 });
  const [keywordInput, setKeywordInput] = useState('');
  const [data, setData] = useState({ list: [], total: 0, page: 1, pageSize: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const seqRef = useRef(0);
  const { ask, confirmNode } = useConfirm();

  useEffect(() => {
    let alive = true;
    listCourses()
      .then((list) => {
        if (!alive) return;
        setCourses(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const load = useCallback(async () => {
    const seq = ++seqRef.current;
    setLoading(true);
    setError('');
    try {
      const res = await listQuestions({
        courseId: filters.courseId ? Number(filters.courseId) : undefined,
        type: filters.type || undefined,
        difficulty: filters.difficulty ? Number(filters.difficulty) : undefined,
        keyword: filters.keyword || undefined,
        page: filters.page,
        pageSize: filters.pageSize
      });
      if (seq === seqRef.current) {
        setData(res || { list: [], total: 0, page: filters.page, pageSize: filters.pageSize });
      }
    } catch (err) {
      if (seq === seqRef.current) setError(err.message);
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const handleSearch = (event) => {
    event.preventDefault();
    setFilters((prev) => ({ ...prev, keyword: keywordInput.trim(), page: 1 }));
  };

  const handleDelete = (question) => {
    ask({
      title: '删除题目',
      message: `题目被任何试卷引用时服务端会拒绝删除。确定删除「${truncate(question.stem, 30)}」吗？`,
      confirmText: '删除',
      danger: true,
      onConfirm: async () => {
        await deleteQuestion(question.id);
        toast.success('题目已删除');
        if (data.list.length === 1 && filters.page > 1) {
          setFilters((prev) => ({ ...prev, page: prev.page - 1 }));
        } else {
          setReloadKey((key) => key + 1);
        }
      }
    });
  };

  const columns = [
    {
      key: 'stem',
      title: '题干',
      render: (row) => (
        <div>
          <div className="cell-main">{truncate(row.stem, 70)}</div>
          <div className="cell-sub">
            {row.knowledgePoint ? `知识点：${row.knowledgePoint}` : '未标注知识点'}
            {row.options ? ` · ${row.options.length} 个选项` : ''}
          </div>
        </div>
      )
    },
    {
      key: 'type',
      title: '题型',
      width: 100,
      render: (row) => <Badge tone={TYPE_TONES[row.type]}>{TYPE_LABELS[row.type] || row.type}</Badge>
    },
    {
      key: 'difficulty',
      title: '难度',
      width: 130,
      render: (row) => (
        <span className="difficulty" title={DIFFICULTY_LABELS[row.difficulty]}>
          {'★'.repeat(row.difficulty || 0)}
          <span className="difficulty-rest">{'★'.repeat(Math.max(0, 5 - (row.difficulty || 0)))}</span>
        </span>
      )
    },
    { key: 'score', title: '建议分值', width: 90, align: 'right', render: (row) => row.score },
    {
      key: 'actions',
      title: '操作',
      width: 130,
      render: (row) => (
        <div className="table-actions">
          <button type="button" className="link-btn" onClick={() => setModal({ type: 'edit', question: row })}>
            编辑
          </button>
          <button type="button" className="link-btn danger" onClick={() => handleDelete(row)}>
            删除
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="page">
      <PageHeader
        title="题库管理"
        description="维护课程题库，支持四种题型、难度与知识点标注，可按 JSON 批量导入。"
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModal({ type: 'import' })}>
              批量导入
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setModal({ type: 'create' })} disabled={courses.length === 0}>
              + 新增题目
            </button>
          </>
        }
      />

      <div className="card">
        <form className="toolbar toolbar-wrap" onSubmit={handleSearch}>
          <div className="toolbar-group">
            <label className="toolbar-label" htmlFor="question-course-filter">
              课程
            </label>
            <select
              id="question-course-filter"
              className="select"
              value={filters.courseId}
              onChange={(event) => setFilters((prev) => ({ ...prev, courseId: event.target.value, page: 1 }))}
            >
              <option value="">全部课程</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>
          <div className="toolbar-group">
            <label className="toolbar-label" htmlFor="question-type-filter">
              题型
            </label>
            <select
              id="question-type-filter"
              className="select"
              value={filters.type}
              onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value, page: 1 }))}
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
            <label className="toolbar-label" htmlFor="question-difficulty-filter">
              难度
            </label>
            <select
              id="question-difficulty-filter"
              className="select"
              value={filters.difficulty}
              onChange={(event) => setFilters((prev) => ({ ...prev, difficulty: event.target.value, page: 1 }))}
            >
              <option value="">全部难度</option>
              {[1, 2, 3, 4, 5].map((level) => (
                <option key={level} value={level}>
                  {level} 星
                </option>
              ))}
            </select>
          </div>
          <div className="toolbar-group toolbar-grow">
            <label className="toolbar-label" htmlFor="question-keyword">
              关键字
            </label>
            <input
              id="question-keyword"
              className="input"
              placeholder="按题干搜索"
              value={keywordInput}
              maxLength={100}
              onChange={(event) => setKeywordInput(event.target.value)}
            />
          </div>
          <div className="toolbar-actions">
            <button type="submit" className="btn btn-primary">
              搜索
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setKeywordInput('');
                setFilters({ courseId: '', type: '', difficulty: '', keyword: '', page: 1, pageSize: filters.pageSize });
              }}
            >
              重置
            </button>
          </div>
        </form>

        {error && <div className="alert alert-error">{error}</div>}

        <DataTable
          columns={columns}
          data={data.list}
          loading={loading}
          emptyIcon="📝"
          emptyTitle={filters.courseId || filters.type || filters.keyword ? '没有符合条件的题目' : '题库还没有题目'}
          emptyDescription={
            courses.length === 0
              ? '当前没有可用课程，请先联系管理员创建课程'
              : filters.courseId || filters.type || filters.keyword
                ? '请调整筛选条件后重试'
                : '点击右上角「新增题目」或「批量导入」开始建设题库'
          }
          pagination={{
            page: data.page || filters.page,
            pageSize: data.pageSize || filters.pageSize,
            total: data.total || 0,
            onPageChange: (page) => setFilters((prev) => ({ ...prev, page })),
            onPageSizeChange: (pageSize) => setFilters((prev) => ({ ...prev, pageSize, page: 1 }))
          }}
        />
      </div>

      {modal?.type === 'create' && (
        <QuestionFormModal
          courses={courses}
          defaultCourseId={filters.courseId || (courses[0] ? courses[0].id : '')}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            setReloadKey((key) => key + 1);
          }}
        />
      )}
      {modal?.type === 'edit' && (
        <QuestionFormModal
          question={modal.question}
          courses={courses}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            setReloadKey((key) => key + 1);
          }}
        />
      )}
      {modal?.type === 'import' && (
        <ImportQuestionsModal
          courses={courses}
          defaultCourseId={filters.courseId}
          onClose={() => setModal(null)}
          onImported={() => setReloadKey((key) => key + 1)}
        />
      )}
      {confirmNode}
    </div>
  );
}
