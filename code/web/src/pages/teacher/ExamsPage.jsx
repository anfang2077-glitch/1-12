import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { assignStudents, deleteExam, listExams, publishExam } from '../../api/exams';
import { listCourses } from '../../api/courses';
import { listUsers } from '../../api/users';
import { useAuth } from '../../contexts/AuthContext';
import useConfirm from '../../hooks/useConfirm';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';
import {
  EXAM_STATUS_LABELS,
  EXAM_STATUS_TONES,
  formatScore
} from '../../utils/format';
import { toast } from '../../utils/toast';

function AssignModal({ exam, onClose, onSaved }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [students, setStudents] = useState([]);
  const [studentKeyword, setStudentKeyword] = useState('');
  const [studentLoading, setStudentLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [manualIds, setManualIds] = useState([]);
  const [manualInput, setManualInput] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { ask, confirmNode } = useConfirm();

  const loadStudents = useCallback(
    async (keyword) => {
      if (!isAdmin) return;
      setStudentLoading(true);
      try {
        const res = await listUsers({ role: 'student', keyword: keyword || undefined, page: 1, pageSize: 100 });
        setStudents(res?.list || []);
      } catch (err) {
        setStudents([]);
      } finally {
        setStudentLoading(false);
      }
    },
    [isAdmin]
  );

  useEffect(() => {
    if (isAdmin) loadStudents('');
  }, [isAdmin, loadStudents]);

  const toggleStudent = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const addManualIds = () => {
    const tokens = manualInput.split(/[\s,，、;；]+/).filter(Boolean);
    if (tokens.length === 0) {
      setError('请输入学生用户 ID');
      return;
    }
    const ids = tokens.map((token) => Number(token));
    if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
      setError('学生 ID 必须为正整数');
      return;
    }
    setManualIds((prev) => Array.from(new Set([...prev, ...ids])));
    setManualInput('');
    setError('');
  };

  const submitIds = async (ids, successMessage) => {
    setSubmitting(true);
    setError('');
    try {
      const res = await assignStudents(exam.id, ids);
      toast.success(
        ids.length === 0 ? '已清空指派名单' : successMessage || `已指派 ${res?.assignedCount ?? ids.length} 名学生`
      );
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = () => {
    ask({
      title: '清空指派名单',
      message: '清空后该场考试将没有任何考生，确定继续吗？',
      confirmText: '清空名单',
      danger: true,
      onConfirm: async () => {
        await assignStudents(exam.id, []);
        toast.success('已清空指派名单');
        onSaved();
      }
    });
  };

  const currentIds = isAdmin ? selectedIds : manualIds;

  return (
    <>
      <Modal
        open
        size="lg"
        title={`指派考生 · ${exam.title}`}
        onClose={submitting ? () => {} : onClose}
        footer={
          <>
            <button type="button" className="btn btn-ghost danger" onClick={handleClear} disabled={submitting}>
              清空名单
            </button>
            <div className="modal-footer-right">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
                取消
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => submitIds(currentIds)}
                disabled={submitting}
              >
                {submitting ? '保存中…' : `保存指派（${currentIds.length} 人）`}
              </button>
            </div>
          </>
        }
      >
        <div className="alert alert-warning">
          指派为<strong>覆盖式</strong>：提交的名单将替换该场考试现有名单（当前已指派 {exam.assignedCount ?? 0} 人）。
        </div>
        {error && <div className="alert alert-error">{error}</div>}

        {isAdmin ? (
          <>
            <div className="toolbar">
              <div className="toolbar-group toolbar-grow">
                <input
                  className="input"
                  placeholder="按姓名 / 用户名搜索学生"
                  value={studentKeyword}
                  onChange={(event) => setStudentKeyword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      loadStudents(studentKeyword.trim());
                    }
                  }}
                />
              </div>
              <div className="toolbar-actions">
                <button type="button" className="btn btn-secondary" onClick={() => loadStudents(studentKeyword.trim())} disabled={studentLoading}>
                  搜索
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedIds(students.map((student) => student.id))}
                  disabled={students.length === 0}
                >
                  全选当前
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedIds([])} disabled={selectedIds.length === 0}>
                  清空选择
                </button>
              </div>
            </div>

            {studentLoading ? (
              <div className="muted">正在加载学生列表…</div>
            ) : students.length === 0 ? (
              <EmptyState icon="👥" title="没有找到学生" description="请调整搜索关键字，或先在用户管理中创建学生账号" />
            ) : (
              <div className="student-pick-list">
                {students.map((student) => (
                  <label key={student.id} className={`student-pick ${selectedIds.includes(student.id) ? 'checked' : ''}`}>
                    <input type="checkbox" checked={selectedIds.includes(student.id)} onChange={() => toggleStudent(student.id)} />
                    <span className="student-pick-name">{student.realName}</span>
                    <span className="student-pick-meta">
                      {student.username}
                      {student.status === 0 ? '（已禁用）' : ''}
                    </span>
                  </label>
                ))}
              </div>
            )}
            <div className="form-hint">单次最多展示 100 名学生，可通过关键字搜索定位。</div>
          </>
        ) : (
          <>
            <div className="alert alert-info">
              当前账号为教师，接口契约中「用户列表」仅管理员可调用，因此无法直接拉取学生名单。请向管理员获取学生用户 ID 后在此录入（可一次输入多个）。
            </div>
            <div className="toolbar">
              <div className="toolbar-group toolbar-grow">
                <input
                  className="input"
                  placeholder="输入学生 ID，如 3, 4, 5"
                  value={manualInput}
                  onChange={(event) => setManualInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addManualIds();
                    }
                  }}
                />
              </div>
              <div className="toolbar-actions">
                <button type="button" className="btn btn-secondary" onClick={addManualIds}>
                  添加
                </button>
              </div>
            </div>
            {manualIds.length === 0 ? (
              <div className="muted">尚未录入学生 ID。</div>
            ) : (
              <div className="chip-list">
                {manualIds.map((id) => (
                  <span className="chip" key={id}>
                    学生 #{id}
                    <button
                      type="button"
                      className="chip-remove"
                      aria-label={`移除学生 ${id}`}
                      onClick={() => setManualIds((prev) => prev.filter((item) => item !== id))}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="form-hint">提交时会校验每个 ID 是否为存在的学生账号，非法 ID 会被服务端拒绝。</div>
          </>
        )}
      </Modal>
      {confirmNode}
    </>
  );
}

export default function ExamsPage() {
  const [exams, setExams] = useState([]);
  const [courses, setCourses] = useState([]);
  const [filters, setFilters] = useState({ status: '', courseId: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assignExam, setAssignExam] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const { ask, confirmNode } = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await listExams({
        status: filters.status || undefined,
        courseId: filters.courseId ? Number(filters.courseId) : undefined
      });
      setExams(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  useEffect(() => {
    let alive = true;
    listCourses()
      .then((list) => {
        if (alive) setCourses(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const summary = useMemo(() => {
    const draftCount = exams.filter((exam) => exam.status === 'draft').length;
    const publishedCount = exams.filter((exam) => exam.status === 'published').length;
    return { draftCount, publishedCount };
  }, [exams]);

  const handlePublish = (exam) => {
    ask({
      title: '发布考试',
      message: `发布后将进入「已发布」状态，学生可在考试时间窗内作答。发布前请确认试卷有题、及格线不高于总分。确定发布「${exam.title}」吗？`,
      confirmText: '发布',
      onConfirm: async () => {
        await publishExam(exam.id);
        toast.success('考试已发布');
        setReloadKey((key) => key + 1);
      }
    });
  };

  const handleDelete = (exam) => {
    ask({
      title: '删除考试',
      message: `仅草稿状态且无答卷的考试可删除，删除后不可恢复。确定删除「${exam.title}」吗？`,
      confirmText: '删除',
      danger: true,
      onConfirm: async () => {
        await deleteExam(exam.id);
        toast.success('考试已删除');
        setReloadKey((key) => key + 1);
      }
    });
  };

  const columns = [
    {
      key: 'title',
      title: '考试名称',
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
    {
      key: 'time',
      title: '考试时间窗',
      width: 200,
      render: (row) => (
        <div className="cell-sub">
          <div>{row.startTime}</div>
          <div>至 {row.endTime}</div>
        </div>
      )
    },
    { key: 'durationMin', title: '时长', width: 80, render: (row) => `${row.durationMin} 分钟` },
    {
      key: 'score',
      title: '总分 / 及格线',
      width: 120,
      render: (row) => `${formatScore(row.totalScore)} / ${formatScore(row.passScore)}`
    },
    { key: 'questionCount', title: '题目数', width: 80, align: 'right' },
    {
      key: 'actions',
      title: '操作',
      width: 230,
      render: (row) => (
        <div className="table-actions">
          {row.status === 'draft' && (
            <>
              <Link className="link-btn" to={`/teacher/exams/new?id=${row.id}`}>
                编辑
              </Link>
              <button type="button" className="link-btn" onClick={() => setAssignExam(row)}>
                指派
              </button>
              <button type="button" className="link-btn" onClick={() => handlePublish(row)}>
                发布
              </button>
              <button type="button" className="link-btn danger" onClick={() => handleDelete(row)}>
                删除
              </button>
            </>
          )}
          {row.status === 'published' && (
            <>
              <button type="button" className="link-btn" onClick={() => setAssignExam(row)}>
                指派
              </button>
              <Link className="link-btn" to={`/teacher/stats?examId=${row.id}`}>
                统计
              </Link>
            </>
          )}
          {row.status === 'closed' && (
            <Link className="link-btn" to={`/teacher/stats?examId=${row.id}`}>
              统计
            </Link>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="page">
      <PageHeader
        title="考试管理"
        description={`共 ${exams.length} 场考试 · 草稿 ${summary.draftCount} 场 · 已发布 ${summary.publishedCount} 场`}
        actions={
          <Link className="btn btn-primary" to="/teacher/exams/new">
            + 新建考试
          </Link>
        }
      />

      <div className="card">
        <div className="toolbar">
          <div className="toolbar-group">
            <label className="toolbar-label" htmlFor="exam-status">
              状态
            </label>
            <select
              id="exam-status"
              className="select"
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="">全部状态</option>
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
              <option value="closed">已关闭</option>
            </select>
          </div>
          <div className="toolbar-group">
            <label className="toolbar-label" htmlFor="exam-course">
              课程
            </label>
            <select
              id="exam-course"
              className="select"
              value={filters.courseId}
              onChange={(event) => setFilters((prev) => ({ ...prev, courseId: event.target.value }))}
            >
              <option value="">全部课程</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>
          <div className="toolbar-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setReloadKey((key) => key + 1)} disabled={loading}>
              刷新
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <DataTable
          columns={columns}
          data={exams}
          loading={loading}
          emptyIcon="🗂️"
          emptyTitle={filters.status || filters.courseId ? '没有符合条件的考试' : '暂无考试'}
          emptyDescription={filters.status || filters.courseId ? '请调整筛选条件后重试' : '点击右上角「新建考试」从题库组卷'}
          emptyAction={
            !filters.status && !filters.courseId ? (
              <Link className="btn btn-primary" to="/teacher/exams/new">
                去组卷
              </Link>
            ) : null
          }
        />
      </div>

      <div className="alert alert-info">
        提示：草稿考试可修改题目与分值；发布前需保证试卷有题、总分大于 0、及格线不高于总分；发布后试卷内容锁定。
      </div>

      {assignExam && (
        <AssignModal
          exam={assignExam}
          onClose={() => setAssignExam(null)}
          onSaved={() => {
            setAssignExam(null);
            setReloadKey((key) => key + 1);
          }}
        />
      )}
      {confirmNode}
    </div>
  );
}
