'use strict';

const { createTestContext } = require('./helpers');

describe('用户管理（管理员）', () => {
  let ctx;
  beforeEach(async () => {
    ctx = await createTestContext();
  });

  test('B03 分页列表返回 list/total/page/pageSize 且不含密码哈希', async () => {
    const res = await ctx.agent
      .get('/api/users?page=1&pageSize=2')
      .set(ctx.auth('admin'));
    expect(res.status).toBe(200);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.pageSize).toBe(2);
    expect(res.body.data.total).toBe(4);
    expect(res.body.data.list).toHaveLength(2);
    expect(res.body.data.list[0]).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('password_hash');
  });

  test('B03 支持 role 与 keyword 过滤', async () => {
    const byRole = await ctx.agent.get('/api/users?role=student').set(ctx.auth('admin'));
    expect(byRole.body.data.total).toBe(2);
    const byKeyword = await ctx.agent
      .get(`/api/users?keyword=${encodeURIComponent('王')}`)
      .set(ctx.auth('admin'));
    expect(byKeyword.body.data.total).toBe(1);
    expect(byKeyword.body.data.list[0].username).toBe('student02');
  });

  test('B03 pageSize 越界返回 40001', async () => {
    const res = await ctx.agent.get('/api/users?pageSize=101').set(ctx.auth('admin'));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40001);
    expect(res.body.message).toContain('pageSize');
  });

  test('B03 非管理员调用返回 40301', async () => {
    const res = await ctx.agent.get('/api/users').set(ctx.auth('teacher'));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(40301);
  });

  test('B04 创建用户成功且可用新密码登录', async () => {
    const res = await ctx.agent.post('/api/users').set(ctx.auth('admin')).send({
      username: 'student03',
      password: 'Stu@123',
      realName: '王小华',
      role: 'student',
      email: 'student03@example.com'
    });
    expect(res.status).toBe(201);
    expect(res.body.data.username).toBe('student03');
    expect(res.body.data.status).toBe(1);
    expect(res.body.data).not.toHaveProperty('passwordHash');

    const login = await ctx.agent
      .post('/api/auth/login')
      .send({ username: 'student03', password: 'Stu@123' });
    expect(login.status).toBe(200);
  });

  test('B04 重复用户名返回 40901', async () => {
    const res = await ctx.agent.post('/api/users').set(ctx.auth('admin')).send({
      username: 'student01',
      password: 'Stu@123',
      realName: '重复用户',
      role: 'student'
    });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ code: 40901, message: '用户名已存在' });
  });

  test('B04 角色非法 / 邮箱非法 / 密码过短均返回 40001', async () => {
    const badRole = await ctx.agent.post('/api/users').set(ctx.auth('admin')).send({
      username: 'u100',
      password: 'Stu@123',
      realName: '测试',
      role: 'guest'
    });
    expect(badRole.status).toBe(400);
    expect(badRole.body.message).toContain('角色必须为');

    const badEmail = await ctx.agent.post('/api/users').set(ctx.auth('admin')).send({
      username: 'u101',
      password: 'Stu@123',
      realName: '测试',
      role: 'student',
      email: 'not-an-email'
    });
    expect(badEmail.status).toBe(400);
    expect(badEmail.body.message).toContain('邮箱格式不正确');

    const badPassword = await ctx.agent.post('/api/users').set(ctx.auth('admin')).send({
      username: 'u102',
      password: '123',
      realName: '测试',
      role: 'student'
    });
    expect(badPassword.status).toBe(400);
    expect(badPassword.body.message).toContain('密码长度');
  });

  test('B05 修改用户并可重置密码', async () => {
    const res = await ctx.agent
      .put(`/api/users/${ctx.users.student.id}`)
      .set(ctx.auth('admin'))
      .send({ realName: '李小明（改）', password: 'NewPass@123', email: null });
    expect(res.status).toBe(200);
    expect(res.body.data.realName).toBe('李小明（改）');
    expect(res.body.data.email).toBeNull();

    const oldLogin = await ctx.agent
      .post('/api/auth/login')
      .send({ username: 'student01', password: 'Stu@123' });
    expect(oldLogin.status).toBe(401);
    const newLogin = await ctx.agent
      .post('/api/auth/login')
      .send({ username: 'student01', password: 'NewPass@123' });
    expect(newLogin.status).toBe(200);
  });

  test('B05 用户不存在返回 40401，空更新返回 40001', async () => {
    const notFound = await ctx.agent
      .put('/api/users/999')
      .set(ctx.auth('admin'))
      .send({ realName: '无人' });
    expect(notFound.status).toBe(404);
    expect(notFound.body.code).toBe(40401);

    const empty = await ctx.agent
      .put(`/api/users/${ctx.users.student.id}`)
      .set(ctx.auth('admin'))
      .send({});
    expect(empty.status).toBe(400);
    expect(empty.body.message).toContain('没有需要更新的字段');
  });

  test('B05 管理员不能禁用当前登录账号', async () => {
    const res = await ctx.agent
      .put(`/api/users/${ctx.users.admin.id}`)
      .set(ctx.auth('admin'))
      .send({ status: 0 });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ code: 40901, message: '不能禁用当前登录账号' });
  });

  test('B06 不能删除当前登录账号', async () => {
    const res = await ctx.agent
      .delete(`/api/users/${ctx.users.admin.id}`)
      .set(ctx.auth('admin'));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe(40901);
  });

  test('B06 有关联数据（课程）的用户不可删除', async () => {
    const res = await ctx.agent
      .delete(`/api/users/${ctx.users.teacher.id}`)
      .set(ctx.auth('admin'));
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('关联数据');
  });

  test('B06 无关联数据的用户可删除', async () => {
    const created = await ctx.agent.post('/api/users').set(ctx.auth('admin')).send({
      username: 'student09',
      password: 'Stu@123',
      realName: '待删除',
      role: 'student'
    });
    const id = created.body.data.id;
    const res = await ctx.agent.delete(`/api/users/${id}`).set(ctx.auth('admin'));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id });
    const list = await ctx.agent.get('/api/users?keyword=student09').set(ctx.auth('admin'));
    expect(list.body.data.total).toBe(0);
  });

  test('B06 删除不存在的用户返回 40401', async () => {
    const res = await ctx.agent.delete('/api/users/999').set(ctx.auth('admin'));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(40401);
  });
});
