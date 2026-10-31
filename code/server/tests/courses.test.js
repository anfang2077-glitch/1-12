'use strict';

const { createTestContext, createTeacher } = require('./helpers');

describe('课程管理', () => {
  let ctx;
  beforeEach(async () => {
    ctx = await createTestContext();
  });

  test('B07 管理员与学生的课程列表为全部课程', async () => {
    const adminRes = await ctx.agent.get('/api/courses').set(ctx.auth('admin'));
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data).toHaveLength(2);
    expect(adminRes.body.data[0].teacherName).toBe('张老师');

    const studentRes = await ctx.agent.get('/api/courses').set(ctx.auth('student'));
    expect(studentRes.body.data).toHaveLength(2);
  });

  test('B07 教师只看到本人课程', async () => {
    const teacher2 = await createTeacher(ctx);
    await ctx.agent.post('/api/courses').set(teacher2.auth).send({
      name: '离散数学',
      code: 'MA101'
    });
    const mine = await ctx.agent.get('/api/courses').set(ctx.auth('teacher'));
    const others = await ctx.agent.get('/api/courses').set(teacher2.auth);
    expect(mine.body.data).toHaveLength(2);
    expect(others.body.data).toHaveLength(1);
    expect(others.body.data[0].code).toBe('MA101');
  });

  test('B08 教师创建课程时 teacherId 强制为自己', async () => {
    const res = await ctx.agent.post('/api/courses').set(ctx.auth('teacher')).send({
      name: '操作系统',
      code: 'CS203',
      description: '进程与内存',
      teacherId: ctx.users.admin.id
    });
    expect(res.status).toBe(201);
    expect(res.body.data.teacherId).toBe(ctx.users.teacher.id);
    expect(res.body.data.teacherName).toBe('张老师');
  });

  test('B08 管理员可指定教师创建课程', async () => {
    const res = await ctx.agent.post('/api/courses').set(ctx.auth('admin')).send({
      name: '操作系统',
      code: 'CS204',
      teacherId: ctx.users.teacher.id
    });
    expect(res.status).toBe(201);
    expect(res.body.data.teacherId).toBe(ctx.users.teacher.id);
  });

  test('B08 课程代码重复返回 40901', async () => {
    const res = await ctx.agent.post('/api/courses').set(ctx.auth('teacher')).send({
      name: '重复课程',
      code: 'CS201'
    });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ code: 40901, message: '课程代码已存在' });
  });

  test('B08 学生创建课程返回 40301', async () => {
    const res = await ctx.agent.post('/api/courses').set(ctx.auth('student')).send({
      name: '非法课程',
      code: 'XX001'
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(40301);
  });

  test('B09 教师修改他人课程返回 40301', async () => {
    const teacher2 = await createTeacher(ctx);
    const res = await ctx.agent
      .put('/api/courses/1')
      .set(teacher2.auth)
      .send({ name: '篡改课程' });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ code: 40301, message: '无权限操作该课程' });
  });

  test('B09 教师修改本人课程成功', async () => {
    const res = await ctx.agent
      .put('/api/courses/1')
      .set(ctx.auth('teacher'))
      .send({ name: '数据结构（2026 秋）', description: '新增实验' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('数据结构（2026 秋）');
  });

  test('B09 课程代码与他人重复返回 40901，不存在返回 40401', async () => {
    const conflict = await ctx.agent
      .put('/api/courses/1')
      .set(ctx.auth('teacher'))
      .send({ code: 'CS202' });
    expect(conflict.status).toBe(409);
    expect(conflict.body.message).toBe('课程代码已存在');

    const notFound = await ctx.agent
      .put('/api/courses/999')
      .set(ctx.auth('admin'))
      .send({ name: '不存在' });
    expect(notFound.status).toBe(404);
  });

  test('B10 删除有题目的课程返回 40901', async () => {
    const res = await ctx.agent.delete('/api/courses/1').set(ctx.auth('admin'));
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ code: 40901, message: '该课程下存在题目，无法删除' });
  });

  test('B10 删除空课程成功', async () => {
    const created = await ctx.agent.post('/api/courses').set(ctx.auth('admin')).send({
      name: '空课程',
      code: 'EMPTY01',
      teacherId: ctx.users.teacher.id
    });
    const id = created.body.data.id;
    const res = await ctx.agent.delete(`/api/courses/${id}`).set(ctx.auth('admin'));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id });
  });

  test('B10 教师删除课程返回 40301', async () => {
    const res = await ctx.agent.delete('/api/courses/1').set(ctx.auth('teacher'));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(40301);
  });
});
