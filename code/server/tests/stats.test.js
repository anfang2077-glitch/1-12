'use strict';

const { createTestContext, createTeacher } = require('./helpers');

describe('成绩统计', () => {
  let ctx;
  beforeEach(async () => {
    ctx = await createTestContext();
  });

  test('B33 管理员全局概览返回 7 项计数', async () => {
    const res = await ctx.agent.get('/api/stats/overview').set(ctx.auth('admin'));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      userCount: 4,
      teacherCount: 1,
      studentCount: 2,
      courseCount: 2,
      questionCount: 16,
      examCount: 2,
      attemptCount: 1
    });
  });

  test('B33 教师 / 学生调用全局概览返回 40301', async () => {
    const teacher = await ctx.agent.get('/api/stats/overview').set(ctx.auth('teacher'));
    expect(teacher.status).toBe(403);
    const student = await ctx.agent.get('/api/stats/overview').set(ctx.auth('student'));
    expect(student.status).toBe(403);
  });

  test('B34 场次摘要列表按考试聚合，count 只统计已交卷答卷', async () => {
    const res = await ctx.agent.get('/api/stats/exams').set(ctx.auth('teacher'));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const midterm = res.body.data.find((item) => item.examId === 1);
    expect(midterm).toMatchObject({
      title: '数据结构期中考试',
      count: 1,
      avg: 50,
      max: 50,
      min: 50,
      passRate: 0
    });
    const draft = res.body.data.find((item) => item.examId === 2);
    expect(draft).toMatchObject({ count: 0, avg: 0, max: 0, min: 0, passRate: 0 });
  });

  test('B34 学生调用场次摘要返回 40301', async () => {
    const res = await ctx.agent.get('/api/stats/exams').set(ctx.auth('student'));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(40301);
  });

  test('B35 单场统计返回五段分布与逐题正确率', async () => {
    const res = await ctx.agent.get('/api/stats/exams/1').set(ctx.auth('teacher'));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      title: '数据结构期中考试',
      count: 1,
      avg: 50,
      max: 50,
      min: 50,
      passRate: 0
    });
    expect(res.body.data.distribution).toEqual([
      { label: '[0,60)', count: 1 },
      { label: '[60,70)', count: 0 },
      { label: '[70,80)', count: 0 },
      { label: '[80,90)', count: 0 },
      { label: '[90,100]', count: 0 }
    ]);
    const sum = res.body.data.distribution.reduce((total, item) => total + item.count, 0);
    expect(sum).toBe(res.body.data.count);

    const map = new Map(res.body.data.questions.map((item) => [item.questionId, item]));
    expect(map.get(1)).toMatchObject({ type: 'single', accuracy: 100, avgScore: 10 });
    expect(map.get(3)).toMatchObject({ type: 'multiple', accuracy: 0, avgScore: 0 });
    expect(map.get(7)).toMatchObject({ type: 'short', accuracy: 0, avgScore: 0 });
    expect(map.get(6)).toMatchObject({ type: 'judge', accuracy: 100, avgScore: 10 });
  });

  test('B35 试卷总分折算百分制：90 分落入 [90,100]', async () => {
    await ctx.agent
      .post('/api/grading/1')
      .set(ctx.auth('teacher'))
      .send({
        items: [
          { questionId: 7, score: 20 },
          { questionId: 8, score: 20 }
        ]
      });
    const res = await ctx.agent.get('/api/stats/exams/1').set(ctx.auth('teacher'));
    expect(res.body.data.avg).toBe(90);
    expect(res.body.data.passRate).toBe(100);
    expect(res.body.data.distribution[4]).toEqual({ label: '[90,100]', count: 1 });
  });

  test('B35 教师查询他人课程统计返回 40301，考试不存在返回 40401', async () => {
    const teacher2 = await createTeacher(ctx);
    const forbidden = await ctx.agent.get('/api/stats/exams/1').set(teacher2.auth);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.message).toBe('无权限操作该考试');

    const notFound = await ctx.agent.get('/api/stats/exams/999').set(ctx.auth('teacher'));
    expect(notFound.status).toBe(404);
  });

  test('B36 学生查看本人历次成绩', async () => {
    const res = await ctx.agent.get(`/api/stats/students/${ctx.users.student2.id}`).set(ctx.auth('student2'));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      studentId: ctx.users.student2.id,
      studentName: '王小红',
      count: 1,
      avg: 50
    });
    expect(res.body.data.list[0]).toMatchObject({
      attemptId: 1,
      examId: 1,
      examTitle: '数据结构期中考试',
      fullScore: 100,
      passScore: 60,
      totalScore: 50,
      status: 'submitted'
    });
  });

  test('B36 学生查看他人成绩返回 40301', async () => {
    const res = await ctx.agent
      .get(`/api/stats/students/${ctx.users.student2.id}`)
      .set(ctx.auth('student'));
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('无权限访问该用户成绩');
  });

  test('B36 教师可查看有关联的学生，无关联返回 40301', async () => {
    const related = await ctx.agent
      .get(`/api/stats/students/${ctx.users.student2.id}`)
      .set(ctx.auth('teacher'));
    expect(related.status).toBe(200);
    expect(related.body.data.count).toBe(1);

    const assignedOnly = await ctx.agent
      .get(`/api/stats/students/${ctx.users.student.id}`)
      .set(ctx.auth('teacher'));
    expect(assignedOnly.status).toBe(200);
    expect(assignedOnly.body.data.count).toBe(0);

    const teacher2 = await createTeacher(ctx);
    const unrelated = await ctx.agent
      .get(`/api/stats/students/${ctx.users.student2.id}`)
      .set(teacher2.auth);
    expect(unrelated.status).toBe(403);
  });

  test('B36 管理员调用学生成绩返回 40301', async () => {
    const res = await ctx.agent
      .get(`/api/stats/students/${ctx.users.student.id}`)
      .set(ctx.auth('admin'));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(40301);
  });

  test('B36 用户不存在返回 40401，非学生用户返回 40001', async () => {
    const notFound = await ctx.agent
      .get('/api/stats/students/999')
      .set(ctx.auth('teacher'));
    expect(notFound.status).toBe(404);

    const notStudent = await ctx.agent
      .get(`/api/stats/students/${ctx.users.teacher.id}`)
      .set(ctx.auth('teacher'));
    expect(notStudent.status).toBe(400);
    expect(notStudent.body.message).toBe('参数错误：该用户不是学生');
  });

  test('B36 未交卷的学生成绩不计入 count 与 avg', async () => {
    ctx.setNow(new Date());
    const res = await ctx.agent
      .get(`/api/stats/students/${ctx.users.student.id}`)
      .set(ctx.auth('student'));
    expect(res.body.data.count).toBe(0);
    expect(res.body.data.avg).toBe(0);
    expect(res.body.data.list).toEqual([]);
  });
});
