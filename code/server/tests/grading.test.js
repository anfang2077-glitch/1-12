'use strict';

const {
  createTestContext,
  createPublishedExam,
  startAttempt,
  createTeacher
} = require('./helpers');

describe('人工阅卷', () => {
  let ctx;
  let examId;
  let attemptId;

  beforeEach(async () => {
    ctx = await createTestContext();
    const created = await createPublishedExam(ctx, {
      questions: [
        { questionId: 1, score: 10 },
        { questionId: 3, score: 10 },
        { questionId: 7, score: 20 },
        { questionId: 8, score: 20 }
      ]
    });
    examId = created.examId;
    attemptId = (await startAttempt(ctx, examId)).body.data.attemptId;
    const answers = [
      { questionId: 1, answer: 'B' },
      { questionId: 7, answer: '栈后进先出，队列先进先出。' },
      { questionId: 8, answer: '选择基准，划分，递归排序。' }
    ];
    for (const item of answers) {
      await ctx.agent
        .put(`/api/attempts/${attemptId}/answers`)
        .set(ctx.auth('student'))
        .send(item);
    }
    await ctx.agent.post(`/api/attempts/${attemptId}/submit`).set(ctx.auth('student'));
  });

  test('B30 待阅列表返回待评简答题数量，可按 examId 过滤', async () => {
    const scoped = await ctx.agent
      .get(`/api/grading/pending?examId=${examId}`)
      .set(ctx.auth('teacher'));
    expect(scoped.status).toBe(200);
    expect(scoped.body.data).toHaveLength(1);
    expect(scoped.body.data[0]).toMatchObject({
      attemptId,
      studentName: '李小明',
      pendingCount: 2
    });

    const all = await ctx.agent.get('/api/grading/pending').set(ctx.auth('teacher'));
    expect(all.body.data.length).toBe(2);
    expect(all.body.data.some((item) => item.attemptId === 1)).toBe(true);
  });

  test('B30 教师查询他人课程待阅返回 40301', async () => {
    const teacher2 = await createTeacher(ctx);
    const res = await ctx.agent
      .get('/api/grading/pending?examId=1')
      .set(teacher2.auth);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('无权限操作该考试');
  });

  test('B31 阅卷详情包含参考答案、学生作答与 needGrading 标记', async () => {
    const res = await ctx.agent
      .get(`/api/grading/${attemptId}`)
      .set(ctx.auth('teacher'));
    expect(res.status).toBe(200);
    expect(res.body.data.studentName).toBe('李小明');
    expect(res.body.data.status).toBe('submitted');
    expect(res.body.data.pendingCount).toBe(2);
    const map = new Map(res.body.data.items.map((item) => [item.questionId, item]));
    expect(map.get(1).needGrading).toBe(false);
    expect(map.get(1).correctAnswer).toBe('B');
    expect(map.get(7).needGrading).toBe(true);
    expect(map.get(7).studentAnswer).toContain('后进先出');
    expect(map.get(7).fullScore).toBe(20);
  });

  test('B32 评分成功重算主观分与总分，未评完仍保留 pending', async () => {
    const res = await ctx.agent
      .post(`/api/grading/${attemptId}`)
      .set(ctx.auth('teacher'))
      .send({ items: [{ questionId: 7, score: 15, comment: '要点基本正确' }] });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      attemptId,
      status: 'graded',
      objectiveScore: 10,
      subjectiveScore: 15,
      totalScore: 25,
      pendingCount: 1
    });

    const pending = await ctx.agent
      .get(`/api/grading/pending?examId=${examId}`)
      .set(ctx.auth('teacher'));
    expect(pending.body.data).toHaveLength(1);
    expect(pending.body.data[0].pendingCount).toBe(1);
  });

  test('B32 评完所有简答题后从待阅列表移除', async () => {
    const res = await ctx.agent
      .post(`/api/grading/${attemptId}`)
      .set(ctx.auth('teacher'))
      .send({
        items: [
          { questionId: 7, score: 18, comment: '好' },
          { questionId: 8, score: 12 }
        ]
      });
    expect(res.body.data).toMatchObject({
      status: 'graded',
      objectiveScore: 10,
      subjectiveScore: 30,
      totalScore: 40,
      pendingCount: 0
    });

    const pending = await ctx.agent
      .get(`/api/grading/pending?examId=${examId}`)
      .set(ctx.auth('teacher'));
    expect(pending.body.data).toHaveLength(0);
  });

  test('B32 允许重评并覆盖分数', async () => {
    await ctx.agent
      .post(`/api/grading/${attemptId}`)
      .set(ctx.auth('teacher'))
      .send({ items: [{ questionId: 7, score: 5 }] });
    const res = await ctx.agent
      .post(`/api/grading/${attemptId}`)
      .set(ctx.auth('teacher'))
      .send({ items: [{ questionId: 7, score: 18, comment: '复核后加分' }] });
    expect(res.body.data.subjectiveScore).toBe(18);
    expect(res.body.data.totalScore).toBe(28);
  });

  test('B32 分数越界、为负或对客观题评分均返回 40001', async () => {
    const tooHigh = await ctx.agent
      .post(`/api/grading/${attemptId}`)
      .set(ctx.auth('teacher'))
      .send({ items: [{ questionId: 7, score: 21 }] });
    expect(tooHigh.status).toBe(400);
    expect(tooHigh.body.message).toBe('参数错误：第 1 项分数必须在 0~20 之间');

    const negative = await ctx.agent
      .post(`/api/grading/${attemptId}`)
      .set(ctx.auth('teacher'))
      .send({ items: [{ questionId: 7, score: -1 }] });
    expect(negative.status).toBe(400);

    const objective = await ctx.agent
      .post(`/api/grading/${attemptId}`)
      .set(ctx.auth('teacher'))
      .send({ items: [{ questionId: 1, score: 5 }] });
    expect(objective.status).toBe(400);
    expect(objective.body.message).toBe('参数错误：只能对简答题评分');
  });

  test('B32 题目不属于本卷或 items 为空返回 40001', async () => {
    const unrelated = await ctx.agent
      .post(`/api/grading/${attemptId}`)
      .set(ctx.auth('teacher'))
      .send({ items: [{ questionId: 99, score: 1 }] });
    expect(unrelated.status).toBe(400);
    expect(unrelated.body.message).toBe('参数错误：题目 99 不属于本场考试');

    const empty = await ctx.agent
      .post(`/api/grading/${attemptId}`)
      .set(ctx.auth('teacher'))
      .send({ items: [] });
    expect(empty.status).toBe(400);
    expect(empty.body.message).toBe('参数错误：评分项不能为空');
  });

  test('B32 评语超长返回 40001', async () => {
    const res = await ctx.agent
      .post(`/api/grading/${attemptId}`)
      .set(ctx.auth('teacher'))
      .send({ items: [{ questionId: 7, score: 10, comment: 'x'.repeat(501) }] });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('参数错误：评语不能超过 500 字');
  });

  test('B31 未交卷答卷不可阅卷', async () => {
    const created = await createPublishedExam(ctx);
    const fresh = (await startAttempt(ctx, created.examId)).body.data.attemptId;
    const detail = await ctx.agent.get(`/api/grading/${fresh}`).set(ctx.auth('teacher'));
    expect(detail.status).toBe(409);
    expect(detail.body.message).toBe('该答卷尚未交卷，无法阅卷');

    const grade = await ctx.agent
      .post(`/api/grading/${fresh}`)
      .set(ctx.auth('teacher'))
      .send({ items: [{ questionId: 7, score: 1 }] });
    expect(grade.status).toBe(409);
  });

  test('B32 教师阅他人课程答卷返回 40301，学生调用返回 40301', async () => {
    const teacher2 = await createTeacher(ctx);
    const forbidden = await ctx.agent
      .post(`/api/grading/${attemptId}`)
      .set(teacher2.auth)
      .send({ items: [{ questionId: 7, score: 10 }] });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.message).toBe('无权限访问该答卷');

    const student = await ctx.agent
      .get(`/api/grading/${attemptId}`)
      .set(ctx.auth('student'));
    expect(student.status).toBe(403);
    expect(student.body.code).toBe(40301);
  });

  test('阅卷后学生成绩单与统计同步更新', async () => {
    await ctx.agent
      .post(`/api/grading/${attemptId}`)
      .set(ctx.auth('teacher'))
      .send({
        items: [
          { questionId: 7, score: 20 },
          { questionId: 8, score: 20 }
        ]
      });

    const result = await ctx.agent
      .get(`/api/attempts/${attemptId}/result`)
      .set(ctx.auth('student'));
    expect(result.body.data.status).toBe('graded');
    expect(result.body.data.totalScore).toBe(50);
    expect(result.body.data.passed).toBe(true);

    const detail = await ctx.agent
      .get(`/api/stats/exams/${examId}`)
      .set(ctx.auth('teacher'));
    expect(detail.body.data.count).toBe(1);
    expect(detail.body.data.avg).toBe(50);
    expect(detail.body.data.questions.find((item) => item.questionId === 7).accuracy).toBe(100);
  });
});
