'use strict';

const { createTestContext, createExam, createTeacher } = require('./helpers');

describe('考试组卷与发布', () => {
  let ctx;
  beforeEach(async () => {
    ctx = await createTestContext();
  });

  test('B17 创建考试时总分为题目分值之和，状态为 draft', async () => {
    const res = await createExam(ctx);
    expect(res.status).toBe(201);
    expect(res.body.data.totalScore).toBe(70);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.questionCount).toBe(6);
    expect(res.body.data.shuffle).toBe(false);
  });

  test('B17 时间窗非法返回 40001', async () => {
    const res = await createExam(ctx, {
      startTime: ctx.time(120),
      endTime: ctx.time(60)
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      code: 40001,
      message: '参数错误：结束时间必须晚于开始时间'
    });
  });

  test('B17 题目不属于本课程返回 40001', async () => {
    const res = await createExam(ctx, {
      questions: [{ questionId: 9, score: 10 }]
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('参数错误：第 1 题的题目不属于本课程');
  });

  test('B17 同一题目重复组卷返回 40001', async () => {
    const res = await createExam(ctx, {
      questions: [
        { questionId: 1, score: 10 },
        { questionId: 1, score: 10 }
      ]
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('参数错误：同一题目不能重复加入试卷');
  });

  test('B17 教师为他人课程组卷返回 40301', async () => {
    const teacher2 = await createTeacher(ctx);
    const res = await ctx.agent.post('/api/exams').set(teacher2.auth).send({
      title: '越权考试',
      courseId: 1,
      startTime: ctx.time(-10),
      endTime: ctx.time(60),
      durationMin: 30,
      passScore: 10,
      questions: [{ questionId: 1, score: 10 }]
    });
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('无权限操作该课程');
  });

  test('B18 考试详情包含题目答案、解析与指派人数', async () => {
    const res = await ctx.agent.get('/api/exams/1').set(ctx.auth('teacher'));
    expect(res.status).toBe(200);
    expect(res.body.data.questionCount).toBe(8);
    expect(res.body.data.assignedCount).toBe(2);
    expect(res.body.data.questions[0]).toHaveProperty('answer', 'B');
    expect(res.body.data.questions[0].analysis).toContain('n/2');
    expect(res.body.data.questions[6].type).toBe('short');
  });

  test('B19 修改草稿考试并整体替换题目，重算总分', async () => {
    const created = await createExam(ctx);
    const examId = created.body.data.id;
    const res = await ctx.agent
      .put(`/api/exams/${examId}`)
      .set(ctx.auth('teacher'))
      .send({
        title: '修改后的考试',
        questions: [
          { questionId: 1, score: 30 },
          { questionId: 7, score: 20 }
        ]
      });
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('修改后的考试');
    expect(res.body.data.totalScore).toBe(50);
    expect(res.body.data.questionCount).toBe(2);
  });

  test('B19 已发布考试不可修改，返回 40901', async () => {
    const res = await ctx.agent
      .put('/api/exams/1')
      .set(ctx.auth('teacher'))
      .send({ title: '试图修改已发布考试' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ code: 40901, message: '仅草稿状态的考试可以修改' });
  });

  test('B21 发布考试成功，状态变为 published', async () => {
    const created = await createExam(ctx);
    const examId = created.body.data.id;
    const res = await ctx.agent
      .post(`/api/exams/${examId}/publish`)
      .set(ctx.auth('teacher'));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('published');
    expect(res.body.data.totalScore).toBe(70);
    expect(res.body.data.questionCount).toBe(6);
  });

  test('B21 及格线大于总分时发布失败返回 40001', async () => {
    const created = await createExam(ctx, { passScore: 1000 });
    expect(created.status).toBe(201);
    const res = await ctx.agent
      .post(`/api/exams/${created.body.data.id}/publish`)
      .set(ctx.auth('teacher'));
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      code: 40001,
      message: '发布失败：及格线不能大于试卷总分'
    });
  });

  test('B21 重复发布返回 40901', async () => {
    const res = await ctx.agent.post('/api/exams/1/publish').set(ctx.auth('teacher'));
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('仅草稿状态的考试可以发布');
  });

  test('B20 删除草稿考试成功，删除已发布考试返回 40901', async () => {
    const created = await createExam(ctx);
    const examId = created.body.data.id;
    const deleted = await ctx.agent.delete(`/api/exams/${examId}`).set(ctx.auth('teacher'));
    expect(deleted.status).toBe(200);
    expect(deleted.body.data).toEqual({ id: examId });

    const published = await ctx.agent.delete('/api/exams/1').set(ctx.auth('teacher'));
    expect(published.status).toBe(409);
    expect(published.body.message).toBe('仅草稿状态的考试可以删除');
  });

  test('B22 指派为覆盖式，自动去重并校验学生角色', async () => {
    const created = await createExam(ctx);
    const examId = created.body.data.id;
    const first = await ctx.agent
      .post(`/api/exams/${examId}/assign`)
      .set(ctx.auth('teacher'))
      .send({ studentIds: [ctx.users.student.id, ctx.users.student2.id, ctx.users.student.id] });
    expect(first.status).toBe(200);
    expect(first.body.data.assignedCount).toBe(2);
    expect(first.body.data.studentIds).toHaveLength(2);

    const second = await ctx.agent
      .post(`/api/exams/${examId}/assign`)
      .set(ctx.auth('teacher'))
      .send({ studentIds: [ctx.users.student2.id] });
    expect(second.body.data.assignedCount).toBe(1);

    const detail = await ctx.agent.get(`/api/exams/${examId}`).set(ctx.auth('teacher'));
    expect(detail.body.data.assignedCount).toBe(1);

    const notStudent = await ctx.agent
      .post(`/api/exams/${examId}/assign`)
      .set(ctx.auth('teacher'))
      .send({ studentIds: [ctx.users.teacher.id] });
    expect(notStudent.status).toBe(400);
    expect(notStudent.body.message).toContain('不是学生');

    const notExists = await ctx.agent
      .post(`/api/exams/${examId}/assign`)
      .set(ctx.auth('teacher'))
      .send({ studentIds: [9999] });
    expect(notExists.status).toBe(400);
    expect(notExists.body.message).toContain('不存在');
  });

  test('B23 学生可参加考试列表带 attemptStatus 与成绩摘要', async () => {
    const res = await ctx.agent.get('/api/exams/available').set(ctx.auth('student'));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(1);
    expect(res.body.data[0].attemptStatus).toBe('none');
    expect(res.body.data[0].attemptId).toBeNull();
    expect(res.body.data[0].remainingSeconds).toBe(0);
    expect(res.body.data[0].totalScoreObtained).toBeNull();

    const submitted = await ctx.agent.get('/api/exams/available').set(ctx.auth('student2'));
    expect(submitted.body.data[0].attemptStatus).toBe('submitted');
    expect(submitted.body.data[0].attemptId).toBe(1);
    expect(submitted.body.data[0].totalScoreObtained).toBe(50);
  });

  test('B24 学生试卷不含答案与解析', async () => {
    const res = await ctx.agent.get('/api/exams/1/paper').set(ctx.auth('student'));
    expect(res.status).toBe(200);
    expect(res.body.data.exam.title).toBe('数据结构期中考试');
    expect(res.body.data.questions).toHaveLength(8);
    expect(res.body.data.questions[0]).not.toHaveProperty('answer');
    expect(res.body.data.questions[0]).not.toHaveProperty('analysis');
    expect(res.body.data.attempt).toBeNull();
    expect(JSON.stringify(res.body.data)).not.toContain('"answer"');
    expect(JSON.stringify(res.body.data)).not.toContain('analysis');
  });

  test('B24 未指派 / 未发布考试取卷分别返回 40301 / 40901', async () => {
    const created = await createExam(ctx);
    const examId = created.body.data.id;
    await ctx.agent.post(`/api/exams/${examId}/publish`).set(ctx.auth('teacher'));
    const notAssigned = await ctx.agent
      .get(`/api/exams/${examId}/paper`)
      .set(ctx.auth('student'));
    expect(notAssigned.status).toBe(403);
    expect(notAssigned.body).toEqual({ code: 40301, message: '您未被指派该考试' });

    const draft = await ctx.agent.get('/api/exams/2/paper').set(ctx.auth('student'));
    expect(draft.status).toBe(409);
    expect(draft.body.message).toBe('考试尚未发布');
  });

  test('B16 考试列表按状态过滤，教师只能看到本人课程', async () => {
    const all = await ctx.agent.get('/api/exams').set(ctx.auth('teacher'));
    expect(all.body.data).toHaveLength(2);

    const published = await ctx.agent
      .get('/api/exams?status=published')
      .set(ctx.auth('teacher'));
    expect(published.body.data).toHaveLength(1);
    expect(published.body.data[0].status).toBe('published');

    const teacher2 = await createTeacher(ctx);
    const other = await ctx.agent.get('/api/exams').set(teacher2.auth);
    expect(other.body.data).toHaveLength(0);

    const student = await ctx.agent.get('/api/exams').set(ctx.auth('student'));
    expect(student.status).toBe(403);

    const badStatus = await ctx.agent.get('/api/exams?status=archived').set(ctx.auth('teacher'));
    expect(badStatus.status).toBe(400);
    expect(badStatus.body.message).toBe('参数错误：status 取值必须为 draft/published/closed');
  });

  test('B18 教师越权访问他人考试返回 40301，考试不存在返回 40401', async () => {
    const teacher2 = await createTeacher(ctx);
    const forbidden = await ctx.agent.get('/api/exams/1').set(teacher2.auth);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.message).toBe('无权限操作该考试');

    const notFound = await ctx.agent.get('/api/exams/999').set(ctx.auth('teacher'));
    expect(notFound.status).toBe(404);
  });
});
