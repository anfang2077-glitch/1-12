import { useCallback, useEffect, useRef, useState } from 'react';
import { createUser, deleteUser, listUsers, updateUser } from '../../api/users';
import { useAuth } from '../../contexts/AuthContext';
import useConfirm from '../../hooks/useConfirm';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import { ROLE_LABELS } from '../../utils/format';
import { toast } from '../../utils/toast';

const ROLE_TONES = { admin: 'purple', teacher: 'blue', student: 'green' };

function validateEmail(value) {
  if (!value) return '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? '' : '邮箱格式不正确';
}

function RoleBadge({ role }) {
  return <Badge tone={ROLE_TONES[role] || 'gray'}>{ROLE_LABELS[role] || role}</Badge>;
}

function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ username: '', password: '', realName: '', role: 'student', email: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!form.username.trim()) next.username = '请输入用户名';
    else if (form.username.trim().length < 3 || form.username.trim().length > 50) next.username = '用户名长度须为 3~50 个字符';
    else if (!/^[A-Za-z0-9_]+$/.test(form.username.trim())) next.username = '用户名仅支持字母、数字与下划线';
    if (!form.password) next.password = '请输入初始密码';
    else if (form.password.length < 6 || form.password.length > 32) next.password = '密码长度须为 6~32 位';
    if (!form.realName.trim()) next.realName = '请输入真实姓名';
    else if (form.realName.trim().length > 50) next.realName = '真实姓名不能超过 50 个字符';
    const emailError = validateEmail(form.email.trim());
    if (emailError) next.email = emailError;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setFormError('');
    try {
      await createUser({
        username: form.username.trim(),
        password: form.password,
        realName: form.realName.trim(),
        role: form.role,
        email: form.email.trim() || undefined
      });
      toast.success('用户创建成功');
      onCreated();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      title="新增用户"
      onClose={submitting ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            取消
          </button>
          <button type="submit" form="create-user-form" className="btn btn-primary" disabled={submitting}>
            {submitting ? '提交中…' : '创建用户'}
          </button>
        </>
      }
    >
      <form id="create-user-form" className="form" onSubmit={handleSubmit} noValidate>
        {formError && <div className="alert alert-error">{formError}</div>}
        <div className="form-grid">
          <FormField label="用户名" required htmlFor="new-username" error={errors.username} hint="登录名（学号 / 工号），仅字母数字下划线">
            <input id="new-username" className="input" value={form.username} maxLength={50} onChange={(e) => update('username', e.target.value)} autoComplete="off" />
          </FormField>
          <FormField label="初始密码" required htmlFor="new-password" error={errors.password} hint="6~32 位，建议包含字母与数字">
            <input id="new-password" className="input" type="password" value={form.password} maxLength={32} onChange={(e) => update('password', e.target.value)} autoComplete="new-password" />
          </FormField>
          <FormField label="真实姓名" required htmlFor="new-realname" error={errors.realName}>
            <input id="new-realname" className="input" value={form.realName} maxLength={50} onChange={(e) => update('realName', e.target.value)} />
          </FormField>
          <FormField label="角色" required htmlFor="new-role" error={errors.role}>
            <select id="new-role" className="select" value={form.role} onChange={(e) => update('role', e.target.value)}>
              <option value="student">学生</option>
              <option value="teacher">教师</option>
              <option value="admin">管理员</option>
            </select>
          </FormField>
          <FormField label="邮箱" htmlFor="new-email" error={errors.email} className="form-field-span">
            <input id="new-email" className="input" type="email" value={form.email} maxLength={100} onChange={(e) => update('email', e.target.value)} placeholder="选填" />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}

function EditUserModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({ realName: user.realName || '', email: user.email || '', status: String(user.status) });
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
    if (!form.realName.trim()) next.realName = '请输入真实姓名';
    else if (form.realName.trim().length > 50) next.realName = '真实姓名不能超过 50 个字符';
    const emailError = validateEmail(form.email.trim());
    if (emailError) next.email = emailError;
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    setFormError('');
    try {
      await updateUser(user.id, {
        realName: form.realName.trim(),
        email: form.email.trim() || null,
        status: Number(form.status)
      });
      toast.success('用户信息已更新');
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
      title={`编辑用户 · ${user.username}`}
      onClose={submitting ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            取消
          </button>
          <button type="submit" form="edit-user-form" className="btn btn-primary" disabled={submitting}>
            {submitting ? '保存中…' : '保存修改'}
          </button>
        </>
      }
    >
      <form id="edit-user-form" className="form" onSubmit={handleSubmit} noValidate>
        {formError && <div className="alert alert-error">{formError}</div>}
        <div className="form-grid">
          <FormField label="真实姓名" required htmlFor="edit-realname" error={errors.realName}>
            <input id="edit-realname" className="input" value={form.realName} maxLength={50} onChange={(e) => update('realName', e.target.value)} />
          </FormField>
          <FormField label="账号状态" htmlFor="edit-status">
            <select id="edit-status" className="select" value={form.status} onChange={(e) => update('status', e.target.value)}>
              <option value="1">启用</option>
              <option value="0">禁用</option>
            </select>
          </FormField>
          <FormField label="邮箱" htmlFor="edit-email" error={errors.email} className="form-field-span" hint="留空表示清空邮箱">
            <input id="edit-email" className="input" type="email" value={form.email} maxLength={100} onChange={(e) => update('email', e.target.value)} />
          </FormField>
        </div>
        <div className="form-tip">用户名与角色创建后不可修改，以保证历史考试与成绩的归属一致。</div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!password) next.password = '请输入新密码';
    else if (password.length < 6 || password.length > 32) next.password = '密码长度须为 6~32 位';
    if (!confirm) next.confirm = '请再次输入新密码';
    else if (confirm !== password) next.confirm = '两次输入的密码不一致';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    setFormError('');
    try {
      await updateUser(user.id, { password });
      toast.success('密码已重置');
      onClose();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      title={`重置密码 · ${user.realName || user.username}`}
      onClose={submitting ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            取消
          </button>
          <button type="submit" form="reset-password-form" className="btn btn-primary" disabled={submitting}>
            {submitting ? '重置中…' : '确认重置'}
          </button>
        </>
      }
    >
      <form id="reset-password-form" className="form" onSubmit={handleSubmit} noValidate>
        {formError && <div className="alert alert-error">{formError}</div>}
        <div className="alert alert-warning">重置后旧密码立即失效，请将新密码告知该用户。</div>
        <FormField label="新密码" required htmlFor="reset-password" error={errors.password} hint="6~32 位">
          <input id="reset-password" className="input" type="password" value={password} maxLength={32} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </FormField>
        <FormField label="确认新密码" required htmlFor="reset-password-confirm" error={errors.confirm}>
          <input id="reset-password-confirm" className="input" type="password" value={confirm} maxLength={32} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </FormField>
      </form>
    </Modal>
  );
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [filters, setFilters] = useState({ role: '', keyword: '', page: 1, pageSize: 10 });
  const [keywordInput, setKeywordInput] = useState('');
  const [data, setData] = useState({ list: [], total: 0, page: 1, pageSize: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const seqRef = useRef(0);
  const { ask, confirmNode } = useConfirm();

  const load = useCallback(async () => {
    const seq = ++seqRef.current;
    setLoading(true);
    setError('');
    try {
      const res = await listUsers({
        role: filters.role || undefined,
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

  const reload = () => setReloadKey((key) => key + 1);

  const handleSearch = (event) => {
    event.preventDefault();
    setFilters((prev) => ({ ...prev, keyword: keywordInput.trim(), page: 1 }));
  };

  const handleToggleStatus = (row) => {
    const nextStatus = row.status === 1 ? 0 : 1;
    ask({
      title: nextStatus === 0 ? '禁用用户' : '启用用户',
      message:
        nextStatus === 0
          ? `禁用后「${row.realName}」将无法登录系统，确定继续吗？`
          : `确定启用「${row.realName}」的账号吗？`,
      confirmText: nextStatus === 0 ? '禁用' : '启用',
      danger: nextStatus === 0,
      onConfirm: async () => {
        await updateUser(row.id, { status: nextStatus });
        toast.success(nextStatus === 0 ? '账号已禁用' : '账号已启用');
        await load();
      }
    });
  };

  const handleDelete = (row) => {
    ask({
      title: '删除用户',
      message: `删除后不可恢复；若该用户存在课程、考试或答卷等关联数据，服务端会拒绝删除。确定删除「${row.realName}」吗？`,
      confirmText: '删除',
      danger: true,
      onConfirm: async () => {
        await deleteUser(row.id);
        toast.success('用户已删除');
        if (data.list.length === 1 && filters.page > 1) {
          setFilters((prev) => ({ ...prev, page: prev.page - 1 }));
        } else {
          await load();
        }
      }
    });
  };

  const columns = [
    {
      key: 'username',
      title: '用户名',
      width: 160,
      render: (row) => (
        <div className="cell-main">
          {row.username}
          {row.id === currentUser?.id && <span className="cell-tag">当前登录</span>}
        </div>
      )
    },
    { key: 'realName', title: '真实姓名', width: 120 },
    { key: 'role', title: '角色', width: 100, render: (row) => <RoleBadge role={row.role} /> },
    { key: 'email', title: '邮箱', render: (row) => row.email || <span className="muted">—</span> },
    {
      key: 'status',
      title: '状态',
      width: 90,
      render: (row) => (row.status === 1 ? <Badge tone="green" dot>启用</Badge> : <Badge tone="gray" dot>已禁用</Badge>)
    },
    {
      key: 'createdAt',
      title: '创建时间',
      width: 170,
      render: (row) => <span className="muted">{row.createdAt || '—'}</span>
    },
    {
      key: 'actions',
      title: '操作',
      width: 250,
      render: (row) => {
        const isSelf = row.id === currentUser?.id;
        return (
          <div className="table-actions">
            <button type="button" className="link-btn" onClick={() => setModal({ type: 'edit', user: row })}>
              编辑
            </button>
            <button type="button" className="link-btn" onClick={() => setModal({ type: 'reset', user: row })}>
              重置密码
            </button>
            <button
              type="button"
              className="link-btn"
              disabled={isSelf}
              title={isSelf ? '不能禁用当前登录账号' : ''}
              onClick={() => handleToggleStatus(row)}
            >
              {row.status === 1 ? '禁用' : '启用'}
            </button>
            <button
              type="button"
              className="link-btn danger"
              disabled={isSelf}
              title={isSelf ? '不能删除当前登录账号' : ''}
              onClick={() => handleDelete(row)}
            >
              删除
            </button>
          </div>
        );
      }
    }
  ];

  return (
    <div className="page">
      <PageHeader
        title="用户管理"
        description="维护管理员、教师与学生账号，支持搜索、角色筛选、重置密码与禁用。"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setModal({ type: 'create' })}>
            + 新增用户
          </button>
        }
      />

      <div className="card">
        <form className="toolbar" onSubmit={handleSearch}>
          <div className="toolbar-group">
            <label className="toolbar-label" htmlFor="user-keyword">
              关键字
            </label>
            <input
              id="user-keyword"
              className="input"
              placeholder="用户名 / 真实姓名"
              value={keywordInput}
              maxLength={50}
              onChange={(event) => setKeywordInput(event.target.value)}
            />
          </div>
          <div className="toolbar-group">
            <label className="toolbar-label" htmlFor="user-role">
              角色
            </label>
            <select
              id="user-role"
              className="select"
              value={filters.role}
              onChange={(event) => setFilters((prev) => ({ ...prev, role: event.target.value, page: 1 }))}
            >
              <option value="">全部角色</option>
              <option value="admin">管理员</option>
              <option value="teacher">教师</option>
              <option value="student">学生</option>
            </select>
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
                setFilters({ role: '', keyword: '', page: 1, pageSize: filters.pageSize });
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
          emptyTitle={filters.keyword || filters.role ? '没有符合条件的用户' : '暂无用户'}
          emptyDescription={filters.keyword || filters.role ? '请调整筛选条件后重试' : '点击右上角「新增用户」创建第一个账号'}
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
        <CreateUserModal
          onClose={() => setModal(null)}
          onCreated={() => {
            setModal(null);
            reload();
          }}
        />
      )}
      {modal?.type === 'edit' && (
        <EditUserModal
          user={modal.user}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            reload();
          }}
        />
      )}
      {modal?.type === 'reset' && <ResetPasswordModal user={modal.user} onClose={() => setModal(null)} />}
      {confirmNode}
    </div>
  );
}
