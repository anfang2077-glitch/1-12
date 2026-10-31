'use strict';

const { createTestContext, createPublishedExam, startAttempt } = require('./helpers');

describe('在线答题与交卷', () => {
  let ctx;
  beforeEach(async () => {
    ctx = await createTestContext();
  });

  test('B25 首次开考返回 201 与截止时间，重复开考返回 200 及原答卷', async () => {
    const { examId } = await createPublishedExam(ctx);
    const first = await startAttempt(ctx, examId);
    expect(first.status).toBe(201);
    expect(first.body.data.attemptId).toBeGreaterThan(0);
    expect(first.body.data.remainingSeconds).toBe(3600);
    expect(first.body.data.deadlineAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

    const second = await startAttempt(ctx, examId);
    expect(second.status).toBe(200);
    expect(second.body.data.attemptId).toBe(first.body.data.attemptId);
    expect(second.body.data.deadlineAt).toBe(first.body.data.deadlineAt);
  });

  test('B25 截止时间取 min(开考+时长, 考试结束时间)', async () => {
    const { examId } = await createPublishedExam(ctx, {
      startTime: ctx.time(-10),
      endTime: ctx.time(30),
      durationMin: 60
    });
    const started = await startAttempt(ctx, examId);
    expect(started.body.data.deadlineAt).toBe(ctx.time(30));
    expect(started.body.data.remainingSeconds).toBe(1800);
  });

  test('B25 未发布 / 未指派 / 不在时间窗开考均被拒绝', async () => {
    const draft = await startAttempt(ctx, 2);
    expect(draft.status).toBe(409);
    expect(draft.body.message).toBe('考试尚未发布');

    const unassigned = await createPublishedExam(ctx, { assignTo: ['student2'] });
    const forbidden = await startAttempt(ctx, unassigned.examId);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.message).toBe('您未被指派该考试');

    const notStarted = await createPublishedExam(ctx, {
      startTime: ctx.time(30),
      endTime: ctx.time(120)
    });
    const early = await startAttempt(ctx, notStarted.examId);
    expect(early.status).toBe(409);
    expect(early.body.message).toBe('考试尚未开始');

    const ended = await createPublishedExam(ctx, {
      startTime: ctx.time(-120),
      endTime: ctx.time(-60)
    });
    const late = await startAttempt(ctx, ended.examId);
    expect(late.status).toBe(409);
    expect(late.body.message).toBe('考试已结束');
  });

  test('B26 答卷详情返回题目与已保存答案，且不含标准答案/解析', async () => {
    const { examId } = await createPublishedExam(ctx);
    const started = await startAttempt(ctx, examId);
    const attemptId = started.body.data.attemptId;

    const res = await ctx.agent.get(`/api/attempts/${attemptId}`).set(ctx.auth('student'));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('in_progress');
    expect(res.body.data.totalScore).toBeNull();
    expect(res.body.data.questions).toHaveLength(6);
    expect(res.body.data.questions[0].savedAnswer).toBeNull();
    expect(res.body.data.questions[0]).not.toHaveProperty('answer');
    expect(JSON.stringify(res.body.data)).not.toContain('"analysis"');
  });

  test('B27 单题自动保存单选/多选并可断线恢复', async () => {
    const { examId } = await createPublishedExam(ctx);
    const attemptId = (await startAttempt(ctx, examId)).body.data.attemptId;

    const single = await ctx.agent
      .put(`/api/attempts/${attemptId}/answers`)
      .set(ctx.auth('student'))
      .send({ questionId: 1, answer: 'B' });
    expect(single.status).toBe(200);
    expect(single.body.data.questionId).toBe(1);
    expect(single.body.data.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);

    const multiple = await ctx.agent
      .put(`/api/attempts/${attemptId}/answers`)
      .set(ctx.auth('student'))
      .send({ questionId: 3, answer: ['C', 'A'] });
    expect(multiple.status).toBe(200);

    const restored = await ctx.agent
      .get(`/api/attempts/${attemptId}`)
      .set(ctx.auth('student'));
    const map = new Map(restored.body.data.questions.map((item) => [item.questionId, item]));
    expect(map.get(1).savedAnswer).toBe('B');
    expect(map.get(3).savedAnswer).toEqual(['C', 'A']);
  });

  test('B27 保存不属于本卷的题目返回 40001', async () => {
    const { examId } = await createPublishedExam(ctx);
    const attemptId = (await startAttempt(ctx, examId)).body.data.attemptId;
    const res = await ctx.agent
      .put(`/api/attempts/${attemptId}/answers`)
      .set(ctx.auth('student'))
      .send({ questionId: 9, answer: 'B' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('参数错误：该题目不属于本场考试');
  });

  test('B27 作答结构非法返回 40001', async () => {
    const { examId } = await createPublishedExam(ctx);
    const attemptId = (await startAttempt(ctx, examId)).body.data.attemptId;

    const multiple = await ctx.agent
      .put(`/api/attempts/${attemptId}/answers`)
      .set(ctx.auth('student'))
      .send({ questionId: 3, answer: 'AC' });
    expect(multiple.status).toBe(400);
    expect(multiple.body.message).toBe('参数错误：多选题答案必须为选项字母数组');

    const single = await ctx.agent
      .put(`/api/attempts/${attemptId}/answers`)
      .set(ctx.auth('student'))
      .send({ questionId: 1, answer: 'E' });
    expect(single.status).toBe(400);
    expect(single.body.message).toBe('参数错误：答案必须存在于选项中');
  });

  test('B28 交卷自动判分：单选/判断精确匹配，多选集合一致才得分', async () => {
    const { examId } = await createPublishedExam(ctx);
    const attemptId = (await startAttempt(ctx, examId)).body.data.attemptId;

    const answers = [
      { questionId: 1, answer: 'B' },
      { questionId: 2, answer: 'A' },
      { questionId: 3, answer: ['A', 'C'] },
      { questionId: 5, answer: 'T' },
      { questionId: 6, answer: 'F' },
      { questionId: 7, answer: '栈后进先出，队列先进先出。' }
    ];
    for (const item of answers) {
      await ctx.agent
        .put(`/api/attempts/${attemptId}/answers`)
        .set(ctx.auth('student'))
        .send(item);
    }

    const res = await ctx.agent
      .post(`/api/attempts/${attemptId}/submit`)
      .set(ctx.auth('student'));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      totalScore: 40,
      objectiveScore: 40,
      subjectivePending: 1
    });

    const attempt = await ctx.agent
      .get(`/api/attempts/${attemptId}`)
      .set(ctx.auth('student'));
    expect(attempt.body.data.status).toBe('submitted');
    expect(attempt.body.data.remainingSeconds).toBe(0);
    expect(attempt.body.data.totalScore).toBe(40);
  });

  test('B28 多选少选、多选、错选均为 0 分', async () => {
    const { examId } = await createPublishedExam(ctx);
    const attemptId = (await startAttempt(ctx, examId)).body.data.attemptId;
    const cases = [
      { questionId: 3, answer: ['A'] },
      { questionId: 4, answer: ['A', 'B', 'D'] },
      { questionId: 1, answer: 'A' }
    ];
    for (const item of cases) {
      await ctx.agent
        .put(`/api/attempts/${attemptId}/answers`)
        .set(ctx.auth('student'))
        .send(item);
    }
    const res = await ctx.agent
      .post(`/api/attempts/${attemptId}/submit`)
      .set(ctx.auth('student'));
    expect(res.body.data.objectiveScore).toBe(0);
  });

  test('B28 不含简答题的试卷交卷后直接 graded', async () => {
    const { examId } = await createPublishedExam(ctx, {
      questions: [
        { questionId: 1, score: 10 },
        { questionId: 2, score: 10 }
      ]
    });
    const attemptId = (await startAttempt(ctx, examId)).body.data.attemptId;
    await ctx.agent
      .put(`/api/attempts/${attemptId}/answers`)
      .set(ctx.auth('student'))
      .send({ questionId: 1, answer: 'B' });
    await ctx.agent
      .put(`/api/attempts/${attemptId}/answers`)
      .set(ctx.auth('student'))
      .send({ questionId: 2, answer: 'C' });

    const res = await ctx.agent
      .post(`/api/attempts/${attemptId}/submit`)
      .set(ctx.auth('student'));
    expect(res.body.data).toEqual({
      totalScore: 20,
      objectiveScore: 20,
      subjectivePending: 0
    });
    const attempt = await ctx.agent
      .get(`/api/attempts/${attemptId}`)
      .set(ctx.auth('student'));
    expect(attempt.body.data.status).toBe('graded');
  });

  test('B28 重复交卷幂等，返回既有判分结果', async () => {
    const { examId } = await createPublishedExam(ctx);
    const attemptId = (await startAttempt(ctx, examId)).body.data.attemptId;
    await ctx.agent
      .put(`/api/attempts/${attemptId}/answers`)
      .set(ctx.auth('student'))
      .send({ questionId: 1, answer: 'B' });

    const first = await ctx.agent
      .post(`/api/attempts/${attemptId}/submit`)
      .set(ctx.auth('student'));
    const second = await ctx.agent
      .post(`/api/attempts/${attemptId}/submit`)
      .set(ctx.auth('student'));
    expect(second.status).toBe(200);
    expect(second.body.data).toEqual(first.body.data);
  });

  test('B27 交卷后继续保存答案返回 40901', async () => {
    const { examId } = await createPublishedExam(ctx);
    const attemptId = (await startAttempt(ctx, examId)).body.data.attemptId;
    await ctx.agent.post(`/api/attempts/${attemptId}/submit`).set(ctx.auth('student'));

    const res = await ctx.agent
      .put(`/api/attempts/${attemptId}/answers`)
      .set(ctx.auth('student'))
      .send({ questionId: 1, answer: 'B' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ code: 40901, message: '答卷已提交，不能继续作答' });
  });

  test('B26 超时未交卷时 GET 答卷触发自动交卷', async () => {
    const { examId } = await createPublishedExam(ctx);
    const attemptId = (await startAttempt(ctx, examId)).body.data.attemptId;
    await ctx.agent
      .put(`/api/attempts/${attemptId}/answers`)
      .set(ctx.auth('student'))
      .send({ questionId: 1, answer: 'B' });

    ctx.advance(61 * 60);
    const res = await ctx.agent.get(`/api/attempts/${attemptId}`).set(ctx.auth('student'));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('submitted');
    expect(res.body.data.remainingSeconds).toBe(0);
    expect(res.body.data.totalScore).toBe(10);

    const pending = await ctx.agent
      .post(`/api/attempts/${attemptId}/submit`)
      .set(ctx.auth('student'));
    expect(pending.body.data.objectiveScore).toBe(10);
  });

  test('B27 超时后保存答案先自动交卷并返回 40901', async () => {
    const { examId } = await createPublishedExam(ctx);
    const attemptId = (await startAttempt(ctx, examId)).body.data.attemptId;

    ctx.advance(61 * 60);
    const res = await ctx.agent
      .put(`/api/attempts/${attemptId}/answers`)
      .set(ctx.auth('student'))
      .send({ questionId: 1, answer: 'B' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ code: 40901, message: '考试已结束，答卷已自动提交' });

    const attempt = await ctx.agent
      .get(`/api/attempts/${attemptId}`)
      .set(ctx.auth('student'));
    expect(attempt.body.data.status).toBe('submitted');
  });

  test('B29 成绩与解析包含逐题得分、正确答案与评语字段', async () => {
    const { examId } = await createPublishedExam(ctx);
    const attemptId = (await startAttempt(ctx, examId)).body.data.attemptId;
    await ctx.agent
      .put(`/api/attempts/${attemptId}/answers`)
      .set(ctx.auth('student'))
      .send({ questionId: 1, answer: 'B' });
    await ctx.agent
      .put(`/api/attempts/${attemptId}/answers`)
      .set(ctx.auth('student'))
      .send({ questionId: 3, answer: ['A'] });
    await ctx.agent.post(`/api/attempts/${attemptId}/submit`).set(ctx.auth('student'));

    const res = await ctx.agent
      .get(`/api/attempts/${attemptId}/result`)
      .set(ctx.auth('student'));
    expect(res.status).toBe(200);
    expect(res.body.data.totalScore).toBe(10);
    expect(res.body.data.examTotalScore).toBe(70);
    expect(res.body.data.items).toHaveLength(6);
    const map = new Map(res.body.data.items.map((item) => [item.questionId, item]));
    expect(map.get(1)).toMatchObject({
      myAnswer: 'B',
      correctAnswer: 'B',
      score: 10,
      fullScore: 10
    });
    expect(map.get(3)).toMatchObject({
      myAnswer: ['A'],
      correctAnswer: ['A', 'C'],
      score: 0
    });
    expect(map.get(7).comment).toBeNull();
    expect(map.get(7).analysis).toBeTruthy();
  });

  test('B29 未交卷查询成绩返回 40901', async () => {
    const { examId } = await createPublishedExam(ctx);
    const attemptId = (await startAttempt(ctx, examId)).body.data.attemptId;
    const res = await ctx.agent
      .get(`/api/attempts/${attemptId}/result`)
      .set(ctx.auth('student'));
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ code: 40901, message: '该答卷尚未提交，暂无成绩' });
  });

  test('B26 学生查看他人答卷返回 40301；管理员调用答卷详情返回 40301', async () => {
    const other = await ctx.agent.get('/api/attempts/1').set(ctx.auth('student'));
    expect(other.status).toBe(403);
    expect(other.body.message).toBe('无权限访问该答卷');

    const admin = await ctx.agent.get('/api/attempts/1').set(ctx.auth('admin'));
    expect(admin.status).toBe(403);
    expect(admin.body.code).toBe(40301);
  });

  test('B26 教师可查看本人课程答卷', async () => {
    const res = await ctx.agent.get('/api/attempts/1').set(ctx.auth('teacher'));
    expect(res.status).toBe(200);
    expect(res.body.data.examId).toBe(1);
    expect(res.body.data.status).toBe('submitted');
  });

  test('B29 学生查看本人成绩、管理员查看成绩均放行', async () => {
    const mine = await ctx.agent.get('/api/attempts/1/result').set(ctx.auth('student2'));
    expect(mine.status).toBe(200);
    expect(mine.body.data.totalScore).toBe(50);
    expect(mine.body.data.status).toBe('submitted');

    const admin = await ctx.agent.get('/api/attempts/1/result').set(ctx.auth('admin'));
    expect(admin.status).toBe(200);

    const other = await ctx.agent.get('/api/attempts/1/result').set(ctx.auth('student'));
    expect(other.status).toBe(403);
  });
});
