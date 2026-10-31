'use strict';

const { createTestContext, createTeacher } = require('./helpers');

const SINGLE = {
  courseId: 1,
  type: 'single',
  stem: '测试单选题：2 + 2 = ?',
  options: [
    { key: 'A', text: '3' },
    { key: 'B', text: '4' }
  ],
  answer: 'B',
  score: 5,
  difficulty: 2,
  knowledgePoint: '算术',
  analysis: '基础加法'
};

describe('题库管理', () => {
  let ctx;
  beforeEach(async () => {
    ctx = await createTestContext();
  });

  test('B12 创建单选题成功', async () => {
    const res = await ctx.agent.post('/api/questions').set(ctx.auth('teacher')).send(SINGLE);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      courseId: 1,
      type: 'single',
      answer: 'B',
      score: 5,
      difficulty: 2,
      creatorId: ctx.users.teacher.id
    });
    expect(res.body.data.options).toHaveLength(2);
    expect(res.body.data.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  test('B12 单选答案不是 A~F 单字母返回 40001', async () => {
    const res = await ctx.agent
      .post('/api/questions')
      .set(ctx.auth('teacher'))
      .send({ ...SINGLE, answer: 'AB' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      code: 40001,
      message: '参数错误：单选题答案必须为 A~F 的单个字母'
    });
  });

  test('B12 多选答案少于 2 项返回 40001', async () => {
    const res = await ctx.agent.post('/api/questions').set(ctx.auth('teacher')).send({
      ...SINGLE,
      type: 'multiple',
      answer: ['A']
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('参数错误：多选题答案至少包含 2 个选项');
  });

  test('B12 多选答案重复返回 40001', async () => {
    const res = await ctx.agent.post('/api/questions').set(ctx.auth('teacher')).send({
      ...SINGLE,
      type: 'multiple',
      answer: ['A', 'A']
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('参数错误：多选题答案不能重复');
  });

  test('B12 判断答案非 T/F 返回 40001', async () => {
    const res = await ctx.agent.post('/api/questions').set(ctx.auth('teacher')).send({
      courseId: 1,
      type: 'judge',
      stem: '判断题',
      answer: 'YES',
      score: 5,
      difficulty: 1
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('参数错误：判断题答案必须为 T 或 F');
  });

  test('B12 简答参考答案为空返回 40001', async () => {
    const res = await ctx.agent.post('/api/questions').set(ctx.auth('teacher')).send({
      courseId: 1,
      type: 'short',
      stem: '简答题',
      answer: '   ',
      score: 10,
      difficulty: 2
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('简答题参考答案不能为空');
  });

  test('B12 选择题选项少于 2 项或 key 重复返回 40001', async () => {
    const tooFew = await ctx.agent
      .post('/api/questions')
      .set(ctx.auth('teacher'))
      .send({ ...SINGLE, options: [{ key: 'A', text: '唯一' }] });
    expect(tooFew.status).toBe(400);
    expect(tooFew.body.message).toBe('参数错误：选择题选项至少 2 项');

    const duplicated = await ctx.agent
      .post('/api/questions')
      .set(ctx.auth('teacher'))
      .send({
        ...SINGLE,
        options: [
          { key: 'A', text: '一' },
          { key: 'A', text: '二' }
        ]
      });
    expect(duplicated.status).toBe(400);
    expect(duplicated.body.message).toBe('参数错误：选项 key 不能重复');
  });

  test('B12 答案不在选项中返回 40001', async () => {
    const res = await ctx.agent
      .post('/api/questions')
      .set(ctx.auth('teacher'))
      .send({ ...SINGLE, answer: 'C' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('参数错误：答案必须存在于选项中');
  });

  test('B12 分值不大于 0 或难度越界返回 40001', async () => {
    const zeroScore = await ctx.agent
      .post('/api/questions')
      .set(ctx.auth('teacher'))
      .send({ ...SINGLE, score: 0 });
    expect(zeroScore.status).toBe(400);
    expect(zeroScore.body.message).toContain('分值必须大于 0');

    const badDifficulty = await ctx.agent
      .post('/api/questions')
      .set(ctx.auth('teacher'))
      .send({ ...SINGLE, difficulty: 6 });
    expect(badDifficulty.status).toBe(400);
    expect(badDifficulty.body.message).toBe('参数错误：难度取值范围为 1~5');
  });

  test('B11 题库列表支持分页与多条件过滤', async () => {
    const paged = await ctx.agent
      .get('/api/questions?courseId=1&page=1&pageSize=3')
      .set(ctx.auth('teacher'));
    expect(paged.status).toBe(200);
    expect(paged.body.data.total).toBe(8);
    expect(paged.body.data.list).toHaveLength(3);

    const singles = await ctx.agent
      .get('/api/questions?courseId=1&type=single')
      .set(ctx.auth('teacher'));
    expect(singles.body.data.total).toBe(2);

    const judgments = await ctx.agent
      .get('/api/questions?courseId=1&type=judge&difficulty=1')
      .set(ctx.auth('teacher'));
    expect(judgments.body.data.total).toBe(2);

    const keyword = await ctx.agent
      .get(`/api/questions?courseId=1&keyword=${encodeURIComponent('栈')}`)
      .set(ctx.auth('teacher'));
    expect(keyword.body.data.total).toBeGreaterThanOrEqual(2);
  });

  test('B11 教师查询他人课程题目返回 40301，课程不存在返回 40401', async () => {
    const teacher2 = await createTeacher(ctx);
    const forbidden = await ctx.agent
      .get('/api/questions?courseId=1')
      .set(teacher2.auth);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.message).toBe('无权限操作该课程');

    const notFound = await ctx.agent
      .get('/api/questions?courseId=999')
      .set(ctx.auth('teacher'));
    expect(notFound.status).toBe(404);
  });

  test('B11 学生查询题库返回 40301，题型非法返回 40001', async () => {
    const student = await ctx.agent.get('/api/questions').set(ctx.auth('student'));
    expect(student.status).toBe(403);
    const badType = await ctx.agent.get('/api/questions?type=essay').set(ctx.auth('teacher'));
    expect(badType.status).toBe(400);
    expect(badType.body.message).toBe('参数错误：题型取值必须为 single/multiple/judge/short');
  });

  test('B12 教师向他人课程建题返回 40301', async () => {
    const teacher2 = await createTeacher(ctx);
    const res = await ctx.agent.post('/api/questions').set(teacher2.auth).send(SINGLE);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('无权限操作该课程');
  });

  test('B13 修改题目成功', async () => {
    const res = await ctx.agent
      .put('/api/questions/1')
      .set(ctx.auth('teacher'))
      .send({ stem: '顺序表插入操作的平均移动次数？', difficulty: 4 });
    expect(res.status).toBe(200);
    expect(res.body.data.stem).toBe('顺序表插入操作的平均移动次数？');
    expect(res.body.data.difficulty).toBe(4);
    expect(res.body.data.answer).toBe('B');
  });

  test('B13 已被已发布试卷引用的题目不能修改题型或答案', async () => {
    const res = await ctx.agent
      .put('/api/questions/1')
      .set(ctx.auth('teacher'))
      .send({ answer: 'C' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      code: 40901,
      message: '该题目已被已发布试卷引用，不能修改题型或答案'
    });
  });

  test('B13 已被引用题目的题干仍可修改；空更新返回 40001', async () => {
    const res = await ctx.agent
      .put('/api/questions/1')
      .set(ctx.auth('teacher'))
      .send({ analysis: '更新后的解析' });
    expect(res.status).toBe(200);
    expect(res.body.data.analysis).toBe('更新后的解析');

    const empty = await ctx.agent.put('/api/questions/1').set(ctx.auth('teacher')).send({});
    expect(empty.status).toBe(400);
    expect(empty.body.message).toBe('参数错误：没有需要更新的字段');
  });

  test('B14 删除被试卷引用的题目返回 40901，未引用题目可删除', async () => {
    const referenced = await ctx.agent.delete('/api/questions/1').set(ctx.auth('teacher'));
    expect(referenced.status).toBe(409);
    expect(referenced.body).toEqual({
      code: 40901,
      message: '该题目已被试卷引用，无法删除'
    });

    const created = await ctx.agent
      .post('/api/questions')
      .set(ctx.auth('teacher'))
      .send({ ...SINGLE, stem: '待删除题目' });
    const deleted = await ctx.agent
      .delete(`/api/questions/${created.body.data.id}`)
      .set(ctx.auth('teacher'));
    expect(deleted.status).toBe(200);
    expect(deleted.body.data).toEqual({ id: created.body.data.id });
  });

  test('B15 批量导入部分成功，失败项 index 从 0 开始', async () => {
    const res = await ctx.agent
      .post('/api/questions/import')
      .set(ctx.auth('teacher'))
      .send({
        courseId: 1,
        questions: [
          {
            type: 'judge',
            stem: '队列是先进先出的线性表。',
            answer: 'T',
            score: 3,
            difficulty: 1
          },
          {
            type: 'short',
            stem: '简述栈与队列的区别。',
            answer: '栈后进先出，队列先进先出。',
            score: 10,
            difficulty: 3
          },
          { type: 'short', stem: '非法简答题', answer: '', score: 5, difficulty: 3 }
        ]
      });
    expect(res.status).toBe(200);
    expect(res.body.data.imported).toBe(2);
    expect(res.body.data.failed).toHaveLength(1);
    expect(res.body.data.failed[0].index).toBe(2);
    expect(res.body.data.failed[0].reason).toBe('简答题参考答案不能为空且不超过 500 字');
  });

  test('B15 导入空列表或超过 500 条返回 40001', async () => {
    const empty = await ctx.agent
      .post('/api/questions/import')
      .set(ctx.auth('teacher'))
      .send({ courseId: 1, questions: [] });
    expect(empty.status).toBe(400);
    expect(empty.body.message).toBe('参数错误：导入题目列表不能为空');

    const tooMany = await ctx.agent
      .post('/api/questions/import')
      .set(ctx.auth('teacher'))
      .send({ courseId: 1, questions: Array.from({ length: 501 }, () => ({})) });
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.message).toBe('参数错误：单次最多导入 500 道题');
  });
});
