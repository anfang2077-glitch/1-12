'use strict';

const jwt = require('jsonwebtoken');
const { createTestContext, BASE_CONFIG } = require('./helpers');

describe('认证与基础中间件', () => {
  let ctx;
  beforeEach(async () => {
    ctx = await createTestContext();
  });

  test('B01 登录成功返回 token 与精简用户信息，且不泄露密码哈希', async () => {
    const res = await ctx.agent
      .post('/api/auth/login')
      .send({ username: 'student01', password: 'Stu@123' });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.user).toEqual({
      id: ctx.users.student.id,
      username: 'student01',
      realName: '李小明',
      role: 'student',
      email: 'student01@example.com'
    });
    expect(JSON.stringify(res.body)).not.toContain('password');
  });

  test('B01 用户不存在与密码错误返回同一 40101 提示（防账号枚举）', async () => {
    const noUser = await ctx.agent
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'whatever' });
    const badPassword = await ctx.agent
      .post('/api/auth/login')
      .send({ username: 'student01', password: 'wrong-pass' });
    expect(noUser.status).toBe(401);
    expect(noUser.body).toEqual({ code: 40101, message: '用户名或密码错误' });
    expect(badPassword.status).toBe(401);
    expect(badPassword.body).toEqual({ code: 40101, message: '用户名或密码错误' });
  });

  test('B01 缺少用户名或密码返回 40001', async () => {
    const res = await ctx.agent.post('/api/auth/login').send({ username: 'student01' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40001);
    expect(res.body.message).toContain('用户名和密码不能为空');
  });

  test('B01 被禁用账号登录返回 40301', async () => {
    await ctx.agent
      .put(`/api/users/${ctx.users.student.id}`)
      .set(ctx.auth('admin'))
      .send({ status: 0 });
    const res = await ctx.agent
      .post('/api/auth/login')
      .send({ username: 'student01', password: 'Stu@123' });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ code: 40301, message: '该账号已被禁用，请联系管理员' });
  });

  test('B02 /auth/me 返回数据库中的最新用户信息', async () => {
    const res = await ctx.agent.get('/api/auth/me').set(ctx.auth('teacher'));
    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe('teacher01');
    expect(res.body.data.role).toBe('teacher');
    expect(res.body.data.status).toBe(1);
    expect(res.body.data.createdAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  test('B02 缺少令牌返回 40101', async () => {
    const res = await ctx.agent.get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(40101);
  });

  test('B02 非法令牌返回 40101', async () => {
    const res = await ctx.agent.get('/api/auth/me').set('Authorization', 'Bearer not-a-token');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(40101);
  });

  test('B02 过期令牌返回 40101 且提示重新登录', async () => {
    const token = jwt.sign({ sub: ctx.users.student.id, username: 'student01', role: 'student' }, BASE_CONFIG.jwtSecret, {
      expiresIn: '-1s'
    });
    const res = await ctx.agent.get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(40101);
    expect(res.body.message).toBe('登录状态已失效，请重新登录');
  });

  test('RBAC 学生访问用户管理接口返回 40301', async () => {
    const res = await ctx.agent.get('/api/users').set(ctx.auth('student'));
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ code: 40301, message: '无权限访问该资源' });
  });

  test('未知路由返回 40401，响应头包含 X-Request-Id', async () => {
    const res = await ctx.agent.get('/api/not-exists').set(ctx.auth('admin'));
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ code: 40401, message: '资源不存在' });
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  test('非法 JSON 请求体返回 40001', async () => {
    const res = await ctx.agent
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"username": "student01",');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40001);
  });

  test('请求头 X-Request-Id 会被透传到响应', async () => {
    const res = await ctx.agent
      .get('/api/auth/me')
      .set(ctx.auth('student'))
      .set('X-Request-Id', 'req-test-001');
    expect(res.headers['x-request-id']).toBe('req-test-001');
  });
});
