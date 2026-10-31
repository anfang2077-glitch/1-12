'use strict';

const {
  createTestContext,
  createPublishedExam,
  startAttempt
} = require('./helpers');

/** 题目 ID 约定（种子数据，课程 1）与标准答案 */
const Q = {
  single: 1, // 答案 "B"
  multiple: 3, // 答案 ["A","C"]
  judgeTrue: 5, // 答案 "T"
  judgeFalse: 6, // 答案 "F"
  short: 7 // 参考答案文本
};

/**
 * 业务规则测试：判分边界、超时自动交卷、开考/交卷幂等、阅卷越界与统计口径。
 * 与 api.integration.test.js 的差别：本文件关注「数值与状态」，不重复校验接口形状。
 */
describe('业务规则与判分口径', () => {
  let ctx;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  /** 组卷 + 开考 + 逐题保存 + 交卷，返回 { examId, attemptId, data } */
  async function submitExam({ questions, answers = [], overrides = {}, studentKey = 'student' }) {
    const created = await createPublishedExam(ctx, { questions, passScore: 0, ...overrides });
    const started = await ctx.agent
      .post(`/api/exams/${created.examId}/attempts`)
      .set(ctx.auth(studentKey));
    if (started.status !== 201) {
      throw new Error(`开考失败：${started.status} ${JSON.stringify(started.body)}`);
    }
    const attemptId = started.body.data.attemptId;
    for (const item of answers) {
      const saved = await ctx.agent
        .put(`/api/attempts/${attemptId}/answers`)
        .set(ctx.auth(studentKey))
        .send(item);
      if (saved.status !== 200) {
        throw new Error(`保存答案失败：${saved.status} ${JSON.stringify(saved.body)}`);
      }
    }
    const submitted = await ctx.agent
      .post(`/api/attempts/${attemptId}/submit`)
      .set(ctx.auth(studentKey));
    if (submitted.status !== 200) {
      throw new Error(`交卷失败：${submitted.status} ${JSON.stringify(submitted.body)}`);
    }
    return { examId: created.examId, attemptId, data: submitted.body.data };
  }

  /** 开考默认试卷（6 题 / 70 分 / 60 分钟）并返回 { examId, attemptId, deadlineAt } */
  async function startDefault() {
    const created = await createPublishedExam(ctx);
    const started = await startAttempt(ctx, created.examId);
    if (started.status !== 201) {
      throw new Error(`开考失败：${started.status} ${JSON.stringify(started.body)}`);
    }
    return {
      examId: created.examId,
      attemptId: started.body.data.attemptId,
      deadlineAt: started.body.data.deadlineAt
    };
  }

  async function saveAnswer(attemptId, payload, studentKey = 'student') {
    return ctx.agent
      .put(`/api/attempts/${attemptId}/answers`)
      .set(ctx.auth(studentKey))
      .send(payload);
  }

  // ---------------------------------------------------------------------------
  // 一、客观题自动判分边界
  // ---------------------------------------------------------------------------
  describe('客观题自动判分', () => {
    it('TC-BIZ-01 单选答对得该题满分，答错得 0 分', async () => {
      const right = await submitExam({
        questions: [{ questionId: Q.single, score: 10 }],
        answers: [{ questionId: Q.single, answer: 'B' }]
      });
      expect(right.data).toMatchObject({ totalScore: 10, objectiveScore: 10, subjectivePending: 0 });

      const wrong = await submitExam({
        questions: [{ questionId: Q.single, score: 10 }],
        answers: [{ questionId: Q.single, answer: 'A' }]
      });
      expect(wrong.data).toMatchObject({ totalScore: 0, objectiveScore: 0 });
    });

    it('TC-BIZ-02 判断题答对得满分、答错得 0 分', async () => {
      const trueRight = await submitExam({
        questions: [{ questionId: Q.judgeTrue, score: 8 }],
        answers: [{ questionId: Q.judgeTrue, answer: 'T' }]
      });
      expect(trueRight.data.totalScore).toBe(8);

      const trueWrong = await submitExam({
        questions: [{ questionId: Q.judgeTrue, score: 8 }],
        answers: [{ questionId: Q.judgeTrue, answer: 'F' }]
      });
      expect(trueWrong.data.totalScore).toBe(0);

      const falseRight = await submitExam({
        questions: [{ questionId: Q.judgeFalse, score: 8 }],
        answers: [{ questionId: Q.judgeFalse, answer: 'F' }]
      });
      expect(falseRight.data.totalScore).toBe(8);
    });

    it('TC-BIZ-03 多选集合完全一致得满分，选项顺序不影响判分', async () => {
      const ordered = await submitExam({
        questions: [{ questionId: Q.multiple, score: 15 }],
        answers: [{ questionId: Q.multiple, answer: ['A', 'C'] }]
      });
      expect(ordered.data.totalScore).toBe(15);

      const reversed = await submitExam({
        questions: [{ questionId: Q.multiple, score: 15 }],
        answers: [{ questionId: Q.multiple, answer: ['C', 'A'] }]
      });
      expect(reversed.data.totalScore).toBe(15);
    });

    it('TC-BIZ-04 多选少选（只选对一部分）得 0 分，无部分分', async () => {
      const result = await submitExam({
        questions: [{ questionId: Q.multiple, score: 15 }],
        answers: [{ questionId: Q.multiple, answer: ['A'] }]
      });
      expect(result.data).toMatchObject({ totalScore: 0, objectiveScore: 0 });
    });

    it('TC-BIZ-05 多选多选（多选了错误项）得 0 分', async () => {
      const result = await submitExam({
        questions: [{ questionId: Q.multiple, score: 15 }],
        answers: [{ questionId: Q.multiple, answer: ['A', 'B', 'C'] }]
      });
      expect(result.data.totalScore).toBe(0);
    });

    it('TC-BIZ-06 多选错选（选项数量相同但集合不同）得 0 分', async () => {
      const result = await submitExam({
        questions: [{ questionId: Q.multiple, score: 15 }],
        answers: [{ questionId: Q.multiple, answer: ['A', 'B'] }]
      });
      expect(result.data.totalScore).toBe(0);
    });

    it('TC-BIZ-07 未作答题目按 0 分计，交卷与查分均不报错', async () => {
      const result = await submitExam({
        questions: [
          { questionId: Q.single, score: 10 },
          { questionId: Q.multiple, score: 10 }
        ]
      });
      expect(result.data).toMatchObject({ totalScore: 0, objectiveScore: 0, subjectivePending: 0 });

      const detail = await ctx.agent
        .get(`/api/attempts/${result.attemptId}/result`)
        .set(ctx.auth('student'));
      expect(detail.status).toBe(200);
      expect(detail.body.data.items.every((item) => item.myAnswer === null)).toBe(true);
      expect(detail.body.data.items.every((item) => item.score === 0)).toBe(true);
    });

    it('TC-BIZ-08 简答题不自动给分并计入待阅', async () => {
      const result = await submitExam({
        questions: [{ questionId: Q.short, score: 20 }],
        answers: [{ questionId: Q.short, answer: '栈后进先出，队列先进先出。' }]
      });
      expect(result.data).toMatchObject({ totalScore: 0, objectiveScore: 0, subjectivePending: 1 });

      const rows = await ctx.repos.answers.listByAttempt(result.attemptId);
      const shortRow = rows.find((row) => row.questionId === Q.short);
      expect(shortRow.score).toBe(0);
      expect(shortRow.gradedAt).toBeNull();
    });

    it('TC-BIZ-09 得分以试卷题分为准（覆盖题库建议分值）', async () => {
      const result = await submitExam({
        questions: [{ questionId: Q.single, score: 12 }],
        answers: [{ questionId: Q.single, answer: 'B' }]
      });
      expect(result.data.totalScore).toBe(12);

      const detail = await ctx.agent
        .get(`/api/attempts/${result.attemptId}/result`)
        .set(ctx.auth('student'));
      expect(detail.body.data.examTotalScore).toBe(12);
      expect(detail.body.data.items[0].fullScore).toBe(12);
      expect(detail.body.data.items[0].score).toBe(12);
    });

    it('TC-BIZ-10 混合试卷总分 = 客观分 + 人工主观分，阅卷后重算', async () => {
      const built = await submitExam({
        questions: [
          { questionId: Q.single, score: 10 },
          { questionId: Q.multiple, score: 10 },
          { questionId: Q.short, score: 20 }
        ],
        answers: [
          { questionId: Q.single, answer: 'B' },
          { questionId: Q.multiple, answer: ['A', 'C'] },
          { questionId: Q.short, answer: '栈是后进先出，队列是先进先出。' }
        ]
      });
      expect(built.data).toMatchObject({ objectiveScore: 20, totalScore: 20, subjectivePending: 1 });

      const graded = await ctx.agent
        .post(`/api/grading/${built.attemptId}`)
        .set(ctx.auth('teacher'))
        .send({ items: [{ questionId: Q.short, score: 15, comment: '要点齐全' }] });
      expect(graded.status).toBe(200);
      expect(graded.body.data).toMatchObject({
        status: 'graded',
        objectiveScore: 20,
        subjectiveScore: 15,
        totalScore: 35
      });

      const result = await ctx.agent
        .get(`/api/attempts/${built.attemptId}/result`)
        .set(ctx.auth('student'));
      expect(result.body.data).toMatchObject({ status: 'graded', totalScore: 35, subjectiveScore: 15 });
      expect(result.body.data.items.find((item) => item.questionId === Q.short).comment).toBe('要点齐全');
    });
  });

  // ---------------------------------------------------------------------------
  // 二、超时自动交卷
  // ---------------------------------------------------------------------------
  describe('超时自动交卷', () => {
    it('TC-BIZ-11 到达截止时间后读取答卷自动交卷，提交时间记为 deadline_at', async () => {
      const { attemptId, deadlineAt } = await startDefault();
      await saveAnswer(attemptId, { questionId: Q.single, answer: 'B' });

      ctx.advance(60 * 60 + 5); // 试卷时长 60 分钟，再超时 5 秒
      const res = await ctx.agent.get(`/api/attempts/${attemptId}`).set(ctx.auth('student'));
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('submitted');
      expect(res.body.data.remainingSeconds).toBe(0);
      expect(res.body.data.totalScore).toBe(10);

      const row = await ctx.repos.attempts.findById(attemptId);
      expect(row.status).toBe('submitted');
      expect(row.submittedAt).toBe(deadlineAt);
    });

    it('TC-BIZ-12 超时后写入答案先自动交卷再返回 409，成绩以已保存答案为准', async () => {
      const { attemptId, deadlineAt } = await startDefault();
      await saveAnswer(attemptId, { questionId: Q.single, answer: 'B' });

      ctx.advance(60 * 60 + 5);
      const res = await saveAnswer(attemptId, { questionId: Q.multiple, answer: ['A', 'C'] });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ code: 40901, message: '考试已结束，答卷已自动提交' });

      const row = await ctx.repos.attempts.findById(attemptId);
      expect(row.status).toBe('submitted');
      expect(row.totalScore).toBe(10);
      expect(row.submittedAt).toBe(deadlineAt);
    });

    it('TC-BIZ-13 超时且没有任何已保存答案时仍能交卷，客观分为 0', async () => {
      const { attemptId } = await startDefault();
      ctx.advance(60 * 60 + 5);

      const res = await ctx.agent.get(`/api/attempts/${attemptId}`).set(ctx.auth('student'));
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ status: 'submitted', totalScore: 0 });
    });

    it('TC-BIZ-14 多次触发自动交卷仅一次状态迁移，成绩与提交时间不变', async () => {
      const { attemptId } = await startDefault();
      await saveAnswer(attemptId, { questionId: Q.single, answer: 'B' });
      await saveAnswer(attemptId, { questionId: Q.multiple, answer: ['A'] });

      ctx.advance(60 * 60 + 5);
      const first = await ctx.agent.get(`/api/attempts/${attemptId}`).set(ctx.auth('student'));
      const firstRow = await ctx.repos.attempts.findById(attemptId);
      const second = await ctx.agent.get(`/api/attempts/${attemptId}`).set(ctx.auth('student'));
      const secondRow = await ctx.repos.attempts.findById(attemptId);
      const third = await ctx.agent.post(`/api/attempts/${attemptId}/submit`).set(ctx.auth('student'));

      expect(first.body.data.totalScore).toBe(10);
      expect(second.body.data.totalScore).toBe(10);
      expect(third.body.data.totalScore).toBe(10);
      expect(secondRow.submittedAt).toBe(firstRow.submittedAt);
      expect(secondRow.totalScore).toBe(firstRow.totalScore);
      expect(secondRow.status).toBe('submitted');
    });

    it('TC-BIZ-15 未到截止时间不自动交卷，剩余秒数正确', async () => {
      const { attemptId } = await startDefault();
      ctx.advance(60 * 60 - 5);

      const res = await ctx.agent.get(`/api/attempts/${attemptId}`).set(ctx.auth('student'));
      expect(res.body.data.status).toBe('in_progress');
      expect(res.body.data.remainingSeconds).toBe(5);
      expect(res.body.data.totalScore).toBeNull();
    });

    it('TC-BIZ-16 超时自动交卷后成绩可查，及格判定按总分与及格线比较', async () => {
      const { attemptId } = await startDefault();
      await saveAnswer(attemptId, { questionId: Q.single, answer: 'B' });
      await saveAnswer(attemptId, { questionId: Q.judgeTrue, answer: 'T' });

      ctx.advance(60 * 60 + 5);
      const result = await ctx.agent
        .get(`/api/attempts/${attemptId}/result`)
        .set(ctx.auth('student'));
      expect(result.status).toBe(200);
      expect(result.body.data).toMatchObject({
        status: 'submitted',
        totalScore: 20,
        passed: true,
        examTotalScore: 70,
        passScore: 10
      });
    });

    it('TC-BIZ-17 截止后手动交卷，提交时间同样记为 deadline_at', async () => {
      const { attemptId, deadlineAt } = await startDefault();
      await saveAnswer(attemptId, { questionId: Q.single, answer: 'B' });

      ctx.advance(60 * 60 + 30);
      const res = await ctx.agent.post(`/api/attempts/${attemptId}/submit`).set(ctx.auth('student'));
      expect(res.status).toBe(200);
      expect(res.body.data.totalScore).toBe(10);

      const row = await ctx.repos.attempts.findById(attemptId);
      expect(row.status).toBe('submitted');
      expect(row.submittedAt).toBe(deadlineAt);
    });
  });

  // ---------------------------------------------------------------------------
  // 三、重复开考幂等
  // ---------------------------------------------------------------------------
  describe('重复开考幂等', () => {
    it('TC-BIZ-18 连续两次开考返回同一份答卷，答卷记录不增加', async () => {
      const created = await createPublishedExam(ctx);
      const first = await startAttempt(ctx, created.examId);
      const second = await startAttempt(ctx, created.examId);

      expect(first.status).toBe(201);
      expect(second.status).toBe(200);
      expect(second.body.data.attemptId).toBe(first.body.data.attemptId);
      expect(second.body.data.deadlineAt).toBe(first.body.data.deadlineAt);

      const rows = await ctx.repos.attempts.listByExamIds([created.examId]);
      expect(rows).toHaveLength(1);
    });

    it('TC-BIZ-19 并发多次开考只产生 1 份答卷（一人一卷）', async () => {
      const created = await createPublishedExam(ctx);
      const results = await Promise.all(
        Array.from({ length: 20 }, () => startAttempt(ctx, created.examId))
      );
      const attemptIds = new Set(results.map((item) => item.body.data && item.body.data.attemptId));
      expect(attemptIds.size).toBe(1);
      expect(results.every((item) => item.status === 201 || item.status === 200)).toBe(true);

      const rows = await ctx.repos.attempts.listByExamIds([created.examId]);
      expect(rows).toHaveLength(1);
    });

    it('TC-BIZ-20 已交卷后再次开考被拒绝，不产生新的答卷', async () => {
      const created = await createPublishedExam(ctx);
      const started = await startAttempt(ctx, created.examId);
      await ctx.agent.post(`/api/attempts/${started.body.data.attemptId}/submit`).set(ctx.auth('student'));

      const again = await startAttempt(ctx, created.examId);
      expect(again.status).toBe(409);
      expect(again.body).toEqual({ code: 40901, message: '您已提交该考试，不能重复开考' });

      const rows = await ctx.repos.attempts.listByExamIds([created.examId]);
      expect(rows).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // 四、重复交卷幂等
  // ---------------------------------------------------------------------------
  describe('重复交卷幂等', () => {
    it('TC-BIZ-21 重复交卷 10 次，总分与提交时间恒定', async () => {
      const { attemptId } = await startDefault();
      await saveAnswer(attemptId, { questionId: Q.single, answer: 'B' });

      const first = await ctx.agent.post(`/api/attempts/${attemptId}/submit`).set(ctx.auth('student'));
      const firstRow = await ctx.repos.attempts.findById(attemptId);
      for (let i = 0; i < 9; i += 1) {
        const again = await ctx.agent.post(`/api/attempts/${attemptId}/submit`).set(ctx.auth('student'));
        expect(again.status).toBe(200);
        expect(again.body.data).toEqual(first.body.data);
      }
      const lastRow = await ctx.repos.attempts.findById(attemptId);
      expect(lastRow.totalScore).toBe(firstRow.totalScore);
      expect(lastRow.submittedAt).toBe(firstRow.submittedAt);
      expect(lastRow.status).toBe('submitted');
    });

    it('TC-BIZ-22 交卷后答案写入被拒绝，已保存数据不变', async () => {
      const { attemptId } = await startDefault();
      await saveAnswer(attemptId, { questionId: Q.single, answer: 'B' });
      await ctx.agent.post(`/api/attempts/${attemptId}/submit`).set(ctx.auth('student'));

      const res = await saveAnswer(attemptId, { questionId: Q.single, answer: 'A' });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe(40901);

      const rows = await ctx.repos.answers.listByAttempt(attemptId);
      expect(rows.find((row) => row.questionId === Q.single).answer).toBe('B');
      const attempt = await ctx.repos.attempts.findById(attemptId);
      expect(attempt.totalScore).toBe(10);
    });

    it('TC-BIZ-23 成绩详情与交卷响应返回的总分一致', async () => {
      const { attemptId, data } = await submitExam({
        questions: [
          { questionId: Q.single, score: 10 },
          { questionId: Q.multiple, score: 10 }
        ],
        answers: [
          { questionId: Q.single, answer: 'B' },
          { questionId: Q.multiple, answer: ['A'] }
        ]
      });
      const result = await ctx.agent
        .get(`/api/attempts/${attemptId}/result`)
        .set(ctx.auth('student'));
      expect(result.body.data.totalScore).toBe(data.totalScore);
      expect(result.body.data.objectiveScore).toBe(data.objectiveScore);
    });
  });

  // ---------------------------------------------------------------------------
  // 五、阅卷边界（越界分数、事务无部分写入、幂等）
  // ---------------------------------------------------------------------------
  describe('阅卷评分边界', () => {
    /** 构造一份含 1 道单选（10 分）+ 1 道简答（20 分）的已交卷答卷 */
    async function buildGradingAttempt() {
      const created = await createPublishedExam(ctx, {
        questions: [
          { questionId: Q.single, score: 10 },
          { questionId: Q.short, score: 20 }
        ],
        passScore: 30
      });
      const started = await startAttempt(ctx, created.examId);
      const attemptId = started.body.data.attemptId;
      await saveAnswer(attemptId, { questionId: Q.single, answer: 'B' });
      await saveAnswer(attemptId, { questionId: Q.short, answer: '栈后进先出，队列先进先出。' });
      await ctx.agent.post(`/api/attempts/${attemptId}/submit`).set(ctx.auth('student'));
      return { examId: created.examId, attemptId };
    }

    function grade(attemptId, items) {
      return ctx.agent.post(`/api/grading/${attemptId}`).set(ctx.auth('teacher')).send({ items });
    }

    it('TC-BIZ-24 得分超过该题满分返回 400，且无部分写入', async () => {
      const { attemptId } = await buildGradingAttempt();
      const res = await grade(attemptId, [{ questionId: Q.short, score: 21 }]);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe(40001);
      expect(res.body.message).toBe('参数错误：第 1 项分数必须在 0~20 之间');

      const attempt = await ctx.repos.attempts.findById(attemptId);
      expect(attempt.status).toBe('submitted');
      expect(attempt.subjectiveScore).toBe(0);
      expect(attempt.totalScore).toBe(10);

      const rows = await ctx.repos.answers.listByAttempt(attemptId);
      const shortRow = rows.find((row) => row.questionId === Q.short);
      expect(shortRow.score).toBe(0);
      expect(shortRow.gradedAt).toBeNull();
    });

    it('TC-BIZ-25 得分为负数返回 400', async () => {
      const { attemptId } = await buildGradingAttempt();
      const res = await grade(attemptId, [{ questionId: Q.short, score: -1 }]);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe(40001);

      const attempt = await ctx.repos.attempts.findById(attemptId);
      expect(attempt.status).toBe('submitted');
    });

    it('TC-BIZ-26 0 分与满分两个边界均合法，总分随之重算', async () => {
      const { attemptId } = await buildGradingAttempt();

      const zero = await grade(attemptId, [{ questionId: Q.short, score: 0 }]);
      expect(zero.status).toBe(200);
      expect(zero.body.data).toMatchObject({ subjectiveScore: 0, totalScore: 10, status: 'graded' });

      const full = await grade(attemptId, [{ questionId: Q.short, score: 20 }]);
      expect(full.status).toBe(200);
      expect(full.body.data).toMatchObject({ subjectiveScore: 20, totalScore: 30 });
    });

    it('TC-BIZ-27 得分支持两位小数，三位小数返回 400', async () => {
      const { attemptId } = await buildGradingAttempt();

      const decimal = await grade(attemptId, [{ questionId: Q.short, score: 19.5 }]);
      expect(decimal.status).toBe(200);
      expect(decimal.body.data.totalScore).toBe(29.5);

      const tooPrecise = await grade(attemptId, [{ questionId: Q.short, score: 19.555 }]);
      expect(tooPrecise.status).toBe(400);
      expect(tooPrecise.body.code).toBe(40001);
    });

    it('TC-BIZ-28 重复提交同一评分结果幂等', async () => {
      const { attemptId } = await buildGradingAttempt();
      const items = [{ questionId: Q.short, score: 15, comment: '复核' }];
      const first = await grade(attemptId, items);
      const second = await grade(attemptId, items);
      expect(second.status).toBe(200);
      expect(second.body.data.totalScore).toBe(first.body.data.totalScore);
      expect(second.body.data.subjectiveScore).toBe(15);
      expect(second.body.data.status).toBe('graded');
    });

    it('TC-BIZ-29 客观题不可评分，未交卷答卷不可阅卷', async () => {
      const { attemptId } = await buildGradingAttempt();
      const objective = await grade(attemptId, [{ questionId: Q.single, score: 5 }]);
      expect(objective.status).toBe(400);
      expect(objective.body.message).toBe('参数错误：只能对简答题评分');

      const created = await createPublishedExam(ctx);
      const fresh = (await startAttempt(ctx, created.examId)).body.data.attemptId;
      const notSubmitted = await grade(fresh, [{ questionId: Q.short, score: 1 }]);
      expect(notSubmitted.status).toBe(409);
      expect(notSubmitted.body.code).toBe(40901);
    });
  });

  // ---------------------------------------------------------------------------
  // 六、统计口径
  // ---------------------------------------------------------------------------
  describe('统计口径', () => {
    /** 直接写入学生账号（无需登录），用于构造统计样本 */
    async function createStudentRows(count) {
      const ids = [];
      for (let index = 0; index < count; index += 1) {
        const user = await ctx.repos.users.create({
          username: `qa_stat_${index}`,
          passwordHash: 'not-a-real-hash',
          realName: `统计学生${index}`,
          role: 'student',
          email: null,
          status: 1
        });
        ids.push(user.id);
      }
      return ids;
    }

    /** 直接写入答卷（模拟「已交卷」数据），用于统计类断言 */
    function createAttemptRow({ examId, studentId, status = 'submitted', totalScore = 0, submittedAt }) {
      return ctx.repos.attempts.create({
        examId,
        studentId,
        startedAt: ctx.time(-90),
        submittedAt: status === 'in_progress' ? null : submittedAt || ctx.time(-30),
        deadlineAt: ctx.time(30),
        status,
        objectiveScore: totalScore,
        subjectiveScore: 0,
        totalScore
      });
    }

    it('TC-BIZ-30 十份答卷的五段分布、均值、极值与及格率符合基线口径', async () => {
      const created = await createPublishedExam(ctx, {
        questions: [{ questionId: Q.single, score: 100 }],
        passScore: 60,
        assignTo: []
      });
      const studentIds = await createStudentRows(10);
      const scores = [55, 60, 65, 70, 75, 80, 85, 90, 95, 100];
      for (let index = 0; index < scores.length; index += 1) {
        await createAttemptRow({
          examId: created.examId,
          studentId: studentIds[index],
          totalScore: scores[index]
        });
      }

      const res = await ctx.agent.get(`/api/stats/exams/${created.examId}`).set(ctx.auth('teacher'));
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        count: 10,
        avg: 77.5,
        max: 100,
        min: 55,
        passRate: 90
      });
      expect(res.body.data.distribution).toEqual([
        { label: '[0,60)', count: 1 },
        { label: '[60,70)', count: 2 },
        { label: '[70,80)', count: 2 },
        { label: '[80,90)', count: 2 },
        { label: '[90,100]', count: 3 }
      ]);
      expect(res.body.data.distribution.reduce((sum, item) => sum + item.count, 0)).toBe(10);
    });

    it('TC-BIZ-31 count 只统计 submitted / graded，in_progress 不进入分母', async () => {
      const created = await createPublishedExam(ctx, {
        questions: [{ questionId: Q.single, score: 100 }],
        passScore: 60,
        assignTo: []
      });
      const [first, second] = await createStudentRows(2);
      await createAttemptRow({
        examId: created.examId,
        studentId: first,
        status: 'submitted',
        totalScore: 80
      });
      await createAttemptRow({
        examId: created.examId,
        studentId: second,
        status: 'in_progress'
      });

      const res = await ctx.agent.get(`/api/stats/exams/${created.examId}`).set(ctx.auth('teacher'));
      expect(res.body.data).toMatchObject({ count: 1, avg: 80, max: 80, min: 80, passRate: 100 });
      expect(res.body.data.distribution.reduce((sum, item) => sum + item.count, 0)).toBe(1);
    });

    it('TC-BIZ-32 无已交卷答卷时统计各字段为零值且不报错', async () => {
      const res = await ctx.agent.get('/api/stats/exams/2').set(ctx.auth('teacher'));
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ count: 0, avg: 0, max: 0, min: 0, passRate: 0 });
      expect(res.body.data.distribution).toEqual([
        { label: '[0,60)', count: 0 },
        { label: '[60,70)', count: 0 },
        { label: '[70,80)', count: 0 },
        { label: '[80,90)', count: 0 },
        { label: '[90,100]', count: 0 }
      ]);
      expect(res.body.data.questions.every((item) => item.avgScore === 0)).toBe(true);
    });

    it('TC-BIZ-33 学生个人成绩只统计已交卷答卷，按交卷时间倒序并计算平均分', async () => {
      const studentId = ctx.users.student.id;
      const makeExam = () =>
        createPublishedExam(ctx, {
          questions: [{ questionId: Q.single, score: 100 }],
          passScore: 60,
          assignTo: []
        });
      const examA = await makeExam();
      const examB = await makeExam();
      const examC = await makeExam();

      await createAttemptRow({
        examId: examA.examId,
        studentId,
        status: 'submitted',
        totalScore: 80,
        submittedAt: ctx.time(-30)
      });
      await createAttemptRow({
        examId: examB.examId,
        studentId,
        status: 'graded',
        totalScore: 90,
        submittedAt: ctx.time(-10)
      });
      await createAttemptRow({
        examId: examC.examId,
        studentId,
        status: 'in_progress'
      });

      const res = await ctx.agent.get(`/api/stats/students/${studentId}`).set(ctx.auth('student'));
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ count: 2, avg: 85 });
      expect(res.body.data.list).toHaveLength(2);
      expect(res.body.data.list[0]).toMatchObject({
        examId: examB.examId,
        totalScore: 90,
        status: 'graded',
        fullScore: 100,
        passScore: 60
      });
      expect(res.body.data.list[1]).toMatchObject({ examId: examA.examId, totalScore: 80 });
    });

    it('TC-BIZ-34 及格线边界：总分等于及格线计入及格人数', async () => {
      const created = await createPublishedExam(ctx, {
        questions: [{ questionId: Q.single, score: 100 }],
        passScore: 20,
        assignTo: []
      });
      const [first, second] = await createStudentRows(2);
      await createAttemptRow({
        examId: created.examId,
        studentId: first,
        status: 'submitted',
        totalScore: 20
      });
      await createAttemptRow({
        examId: created.examId,
        studentId: second,
        status: 'submitted',
        totalScore: 19
      });

      const res = await ctx.agent.get(`/api/stats/exams/${created.examId}`).set(ctx.auth('teacher'));
      expect(res.body.data.count).toBe(2);
      expect(res.body.data.passRate).toBe(50);
    });
  });

  // ---------------------------------------------------------------------------
  // 七、发布前校验（异常数据只能经仓储构造）
  // ---------------------------------------------------------------------------
  describe('发布前校验', () => {
    /** 直接写入草稿考试（绕过接口层的组卷校验），用于验证发布前置条件 */
    function createDraftExam({ startTime, endTime, questions, totalScore }) {
      return ctx.repos.exams.createWithQuestions(
        {
          title: '发布校验用考试',
          courseId: 1,
          description: null,
          startTime,
          endTime,
          durationMin: 30,
          totalScore,
          passScore: 0,
          shuffle: false,
          status: 'draft',
          createdBy: ctx.users.teacher.id
        },
        questions
      );
    }

    it('TC-BIZ-35 无题目或时间窗倒置的草稿发布返回 400，状态保持 draft', async () => {
      const noQuestion = await createDraftExam({
        startTime: ctx.time(-10),
        endTime: ctx.time(60),
        totalScore: 0,
        questions: []
      });
      const empty = await ctx.agent
        .post(`/api/exams/${noQuestion.id}/publish`)
        .set(ctx.auth('teacher'));
      expect(empty.status).toBe(400);
      expect(empty.body.message).toBe('发布失败：试卷至少需要 1 道题');
      expect((await ctx.repos.exams.findById(noQuestion.id)).status).toBe('draft');

      const badWindow = await createDraftExam({
        startTime: ctx.time(120),
        endTime: ctx.time(60),
        totalScore: 10,
        questions: [{ questionId: Q.single, score: 10, sortOrder: 1 }]
      });
      const reversed = await ctx.agent
        .post(`/api/exams/${badWindow.id}/publish`)
        .set(ctx.auth('teacher'));
      expect(reversed.status).toBe(400);
      expect(reversed.body.message).toBe('发布失败：考试开始时间必须早于结束时间');
      expect((await ctx.repos.exams.findById(badWindow.id)).status).toBe('draft');
    });
  });
});
