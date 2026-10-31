import { useCallback, useEffect, useState } from 'react';
import { createCourse, deleteCourse, listCourses, updateCourse } from '../../api/courses';
import { listUsers } from '../../api/users';
import useConfirm from '../../hooks/useConfirm';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import { toast } from '../../utils/toast';

function CourseFormModal({ course, teachers, onClose, onSaved }) {
  const isEdit = Boolean(course);
  const [form, setForm] = useState({
    name: course?.name || '',
    code: course?.code || '',
    description: course?.description || '',
    teacherId: course?.teacherId ? String(course.teacherId) : ''
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = '请输入课程名称';
    else if (form.name.trim().length > 100) next.name = '课程名称不能超过 100 个字符';
    if (!form.code.trim()) next.code = '请输入课程代码';
    else if (form.code.trim().length < 2 || form.code.trim().length > 30) next.code = '课程代码长度须为 2~30 个字符';
    else if (!/^[A-Za-z0-9-]+$/.test(form.code.trim())) next.code = '课程代码仅支持字母、数字与连字符';
    if (form.description.length > 500) next.description = '课程简介不能超过 500 个字符';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      description: form.description.trim() || undefined
    };
    if (form.teacherId) payload.teacherId = Number(form.teacherId);

    setSubmitting(true);
    setFormError('');
    try {
      if (isEdit) {
        await updateCourse(course.id, payload);
        toast.success('课程已更新');
      } else {
        await createCourse(payload);
        toast.success('课程创建成功');
      }
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
      title={isEdit ? `编辑课程 · ${course.name}` : '新增课程'}
      onClose={submitting ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            取消
          </button>
          <button type="submit" form="course-form" className="btn btn-primary" disabled={submitting}>
            {submitting ? '保存中…' : isEdit ? '保存修改' : '创建课程'}
          </button>
        </>
      }
    >
      <form id="course-form" className="form" onSubmit={handleSubmit} noValidate>
        {formError && <div className="alert alert-error">{formError}</div>}
        <div className="form-grid">
          <FormField label="课程名称" required htmlFor="course-name" error={errors.name}>
            <input id="course-name" className="input" value={form.name} maxLength={100} onChange={(e) => update('name', e.target.value)} />
          </FormField>
          <FormField label="课程代码" required htmlFor="course-code" error={errors.code} hint="字母、数字、连字符，全局唯一">
            <input id="course-code" className="input" value={form.code} maxLength={30} onChange={(e) => update('code', e.target.value)} placeholder="如 CS201" />
          </FormField>
          <FormField
            label="任课教师"
            htmlFor="course-teacher"
            className="form-field-span"
            hint={teachers.length === 0 ? '暂无教师账号，请先在「用户管理」中创建教师' : '不指定时，由当前管理员作为课程负责人'}
          >
            <select id="course-teacher" className="select" value={form.teacherId} onChange={(e) => update('teacherId', e.target.value)}>
              <option value="">未指定</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.realName}（{teacher.username}）
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="课程简介" htmlFor="course-description" error={errors.description} className="form-field-span">
            <textarea
              id="course-description"
              className="textarea"
              rows={3}
              maxLength={500}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="简要说明课程内容，选填"
            />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}

export default function CoursesPage() {
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [modal, setModal] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const { ask, confirmNode } = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [courseList, teacherPage] = await Promise.all([
        listCourses(),
        listUsers({ role: 'teacher', page: 1, pageSize: 100 })
      ]);
      setCourses(Array.isArray(courseList) ? courseList : []);
      setTeachers(teacherPage?.list || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const filtered = courses.filter((course) => {
    if (!keyword.trim()) return true;
    const text = `${course.name} ${course.code} ${course.teacherName || ''}`.toLowerCase();
    return text.includes(keyword.trim().toLowerCase());
  });

  const handleDelete = (course) => {
    ask({
      title: '删除课程',
      message: `删除后不可恢复；若课程下仍有题目或考试，服务端会拒绝删除。确定删除「${course.name}」吗？`,
      confirmText: '删除',
      danger: true,
      onConfirm: async () => {
        await deleteCourse(course.id);
        toast.success('课程已删除');
        setReloadKey((key) => key + 1);
      }
    });
  };

  const columns = [
    {
      key: 'name',
      title: '课程名称',
      render: (row) => (
        <div>
          <div className="cell-main">{row.name}</div>
          <div className="cell-sub">{row.description || '暂无简介'}</div>
        </div>
      )
    },
    { key: 'code', title: '课程代码', width: 120, render: (row) => <Badge tone="blue">{row.code}</Badge> },
    { key: 'teacherName', title: '任课教师', width: 140, render: (row) => row.teacherName || <span className="muted">未指定</span> },
    {
      key: 'createdAt',
      title: '创建时间',
      width: 170,
      render: (row) => <span className="muted">{row.createdAt || '—'}</span>
    },
    {
      key: 'actions',
      title: '操作',
      width: 140,
      render: (row) => (
        <div className="table-actions">
          <button type="button" className="link-btn" onClick={() => setModal({ type: 'edit', course: row })}>
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
        title="课程管理"
        description={`共 ${courses.length} 门课程·课程是题库与考试的归属单位。`}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setModal({ type: 'create' })}>
            + 新增课程
          </button>
        }
      />

      <div className="card">
        <div className="toolbar">
          <div className="toolbar-group">
            <label className="toolbar-label" htmlFor="course-keyword">
              搜索
            </label>
            <input
              id="course-keyword"
              className="input"
              placeholder="课程名称 / 代码 / 教师"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </div>
          <div className="toolbar-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setKeyword('')} disabled={!keyword}>
              清空
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setReloadKey((key) => key + 1)} disabled={loading}>
              刷新
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          emptyIcon="📚"
          emptyTitle={keyword ? '没有匹配的课程' : '暂无课程'}
          emptyDescription={keyword ? '请更换关键字后重试' : '点击右上角「新增课程」创建课程'}
        />
      </div>

      {modal && (
        <CourseFormModal
          course={modal.type === 'edit' ? modal.course : null}
          teachers={teachers}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            setReloadKey((key) => key + 1);
          }}
        />
      )}
      {confirmNode}
    </div>
  );
}
