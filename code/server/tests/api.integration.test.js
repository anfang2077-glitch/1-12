'use strict';

const jwt = require('jsonwebtoken');
const {
  createTestContext,
  createExam,
  createPublishedExam,
  startAttempt,
  createTeacher
} = require('./helpers');

const TIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/**
 * 接口契约集成测试：覆盖基线 §5.2 ~ §5.9 全部 8 个模块的正常流与异常流
 * （401 / 403 / 404 / 409 / 参数校验 400）。
 * 每个 it 使用独立的内存仓储 + 种子数据上下文，避免用例之间相互污染。
 */
describe('接口契约集成测试（基线 §5）', () => {
  let ctx;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  // ---------------------------------------------------------------------------
  // §5.1 通用约定 / §5.2 认证
  // ---------------------------------------------------------------------------
  describe('§5.1 通用约定与 §5.2 认证', () => {
    it('TC-API-01 未携带令牌访问任一受保护接口均返回 401/40101', async () => {
      const paths = ['/api/auth/me', '/api/courses', '/api/exams', '/api/users', '/api/stats/overview'];
      for (const path of paths) {
        const res = await ctx.agent.get(path);
        expect(res.status).toBe(401);
        expect(res.body).toEqual({ code: 40101, message: '未登录或登录已过期' });
      }
    });

    it('TC-API-02 教师账号登录成功，返回 token 与精简用户信息', async () => {
      const res = await ctx.agent
        .post('/api/auth/login')
        .send({ username: 'teacher01', password: 'Teach@123' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ code: 0, message: 'ok' });
      expect(typeof res.body.data.token).toBe('string');
      expect(res.body.data.token.split('.')).toHaveLength(3);
      expect(res.body.data.user).toEqual({
        id: ctx.users.teacher.id,
        username: 'teacher01',
        realName: '张老师',
        role: 'teacher',
        email: 'teacher01@example.com'
      });
      expect(JSON.stringify(res.body)).not.toContain('password');
    });

    it('TC-API-03 口令错误与账号不存在返回相同的 401/40101 提示', async () => {
      const noUser = await ctx.agent
        .post('/api/auth/login')
        .send({ username: 'nobody', password: 'whatever' });
      const badPassword = await ctx.agent
        .post('/api/auth/login')
        .send({ username: 'teacher01', password: 'Wrong@123' });
      expect(noUser.status).toBe(401);
      expect(badPassword.status).toBe(401);
      expect(noUser.body).toEqual(badPassword.body);
      expect(noUser.body.code).toBe(40101);
      expect(noUser.body.message).toBe('用户名或密码错误');
    });

    it('TC-API-04 登录缺少 password 或请求体为空返回 400/40001', async () => {
      const missing = await ctx.agent.post('/api/auth/login').send({ username: 'teacher01' });
      expect(missing.status).toBe(400);
      expect(missing.body.code).toBe(40001);
      expect(missing.body.message).toContain('用户名和密码不能为空');

      const empty = await ctx.agent.post('/api/auth/login').send({});
      expect(empty.status).toBe(400);
      expect(empty.body.code).toBe(40001);
    });

    it('TC-API-05 被禁用账号登录被拒绝（实现为 403/40301，见缺陷 D-06）', async () => {
      await ctx.agent
        .put(`/api/users/${ctx.users.student.id}`)
        .set(ctx.auth('admin'))
        .send({ status: 0 });
      const res = await ctx.agent
        .post('/api/auth/login')
        .send({ username: 'student01', password: 'Stu@123' });
      expect([401, 403]).toContain(res.status);
      expect([40101, 40301]).toContain(res.body.code);
      expect(res.body.message).toContain('禁用');
    });

    it('TC-API-06 /auth/me 返回当前用户且不含密码哈希，账号禁用后旧令牌立即失效', async () => {
      const me = await ctx.agent.get('/api/auth/me').set(ctx.auth('student'));
      expect(me.status).toBe(200);
      expect(me.body.data).toMatchObject({ id: ctx.users.student.id, role: 'student', status: 1 });
      expect(me.body.data.createdAt).toMatch(TIME_PATTERN);
      expect(me.body.data).not.toHaveProperty('passwordHash');

      await ctx.agent
        .put(`/api/users/${ctx.users.student.id}`)
        .set(ctx.auth('admin'))
        .send({ status: 0 });
      const afterDisabled = await ctx.agent.get('/api/auth/me').set(ctx.auth('student'));
      expect(afterDisabled.status).toBe(401);
      expect(afterDisabled.body.code).toBe(40101);
    });

    it('TC-API-07 伪造签名令牌返回 401/40101', async () => {
      const res = await ctx.agent.get('/api/auth/me').set('Authorization', 'Bearer fake.payload.token');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe(40101);
    });

    it('TC-API-08 学生访问用户管理接口返回 403/40301', async () => {
      const res = await ctx.agent.get('/api/users').set(ctx.auth('student'));
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ code: 40301, message: '无权限访问该资源' });
    });
  });

  // ---------------------------------------------------------------------------
  // §5.3 用户管理
  // ---------------------------------------------------------------------------
  describe('§5.3 用户管理', () => {
    it('TC-API-09 用户列表分页结构完整，缺省 page=1 / pageSize=10', async () => {
      const res = await ctx.agent.get('/api/users').set(ctx.auth('admin'));
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ total: 4, page: 1, pageSize: 10 });
      expect(res.body.data.list).toHaveLength(4);
      expect(res.body.data.list[0]).toEqual({
        id: 1,
        username: 'admin',
        realName: '系统管理员',
        role: 'admin',
        email: 'admin@example.com',
        status: 1,
        createdAt: expect.stringMatching(TIME_PATTERN)
      });
      expect(JSON.stringify(res.body)).not.toContain('password');
    });

    it('TC-API-10 用户列表支持 role 与 keyword 过滤，返回项不含密码哈希', async () => {
      const byRole = await ctx.agent.get('/api/users?role=student').set(ctx.auth('admin'));
      expect(byRole.body.data.total).toBe(2);
      expect(byRole.body.data.list.every((item) => item.role === 'student')).toBe(true);

      const byKeyword = await ctx.agent
        .get(`/api/users?keyword=${encodeURIComponent('王')}`)
        .set(ctx.auth('admin'));
      expect(byKeyword.body.data.total).toBe(1);
      expect(byKeyword.body.data.list[0].username).toBe('student02');
      expect(byKeyword.body.data.list[0]).not.toHaveProperty('passwordHash');

      const paged = await ctx.agent.get('/api/users?page=2&pageSize=3').set(ctx.auth('admin'));
      expect(paged.body.data.list).toHaveLength(1);
      expect(paged.body.data.page).toBe(2);
    });

    it('TC-API-11 新增用户返回 201 且新账号可立即登录', async () => {
      const res = await ctx.agent.post('/api/users').set(ctx.auth('admin')).send({
        username: 'student09',
        password: 'Stu@123',
        realName: '赵小刚',
        role: 'student',
        email: 'student09@example.com'
      });
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ username: 'student09', role: 'student', status: 1 });
      expect(res.body.data).not.toHaveProperty('passwordHash');

      const login = await ctx.agent
        .post('/api/auth/login')
        .send({ username: 'student09', password: 'Stu@123' });
      expect(login.status).toBe(200);

      const search = await ctx.agent.get('/api/users?keyword=student09').set(ctx.auth('admin'));
      expect(search.body.data.total).toBe(1);
    });

    it('TC-API-12 新增用户异常：重复用户名 409、缺字段 400、角色非法 400', async () => {
      const duplicated = await ctx.agent.post('/api/users').set(ctx.auth('admin')).send({
        username: 'student01',
        password: 'Stu@123',
        realName: '重复用户',
        role: 'student'
      });
      expect(duplicated.status).toBe(409);
      expect(duplicated.body).toEqual({ code: 40901, message: '用户名已存在' });

      const missing = await ctx.agent.post('/api/users').set(ctx.auth('admin')).send({
        username: 'student10',
        password: 'Stu@123',
        role: 'student'
      });
      expect(missing.status).toBe(400);
      expect(missing.body.code).toBe(40001);
      expect(missing.body.message).toContain('真实姓名不能为空');

      const badRole = await ctx.agent.post('/api/users').set(ctx.auth('admin')).send({
        username: 'student11',
        password: 'Stu@123',
        realName: '角色错误',
        role: 'guest'
      });
      expect(badRole.status).toBe(400);
      expect(badRole.body.message).toContain('角色必须为');
    });

    it('TC-API-13 修改用户资料并重置口令，旧口令立即失效', async () => {
      const res = await ctx.agent
        .put(`/api/users/${ctx.users.student.id}`)
        .set(ctx.auth('admin'))
        .send({ realName: '李小明（改）', email: null, password: 'NewPass@123' });
      expect(res.status).toBe(200);
      expect(res.body.data.realName).toBe('李小明（改）');
      expect(res.body.data.email).toBeNull();
      expect(res.body.data).not.toHaveProperty('passwordHash');

      const oldLogin = await ctx.agent
        .post('/api/auth/login')
        .send({ username: 'student01', password: 'Stu@123' });
      expect(oldLogin.status).toBe(401);

      const newLogin = await ctx.agent
        .post('/api/auth/login')
        .send({ username: 'student01', password: 'NewPass@123' });
      expect(newLogin.status).toBe(200);
    });

    it('TC-API-14 修改用户异常：目标不存在 404、空更新 400、status 非法 400', async () => {
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

      const badStatus = await ctx.agent
        .put(`/api/users/${ctx.users.student.id}`)
        .set(ctx.auth('admin'))
        .send({ status: 2 });
      expect(badStatus.status).toBe(400);
      expect(badStatus.body.message).toContain('status');
    });

    it('TC-API-15 删除无关联用户成功，重复删除返回 404', async () => {
      const created = await ctx.agent.post('/api/users').set(ctx.auth('admin')).send({
        username: 'student12',
        password: 'Stu@123',
        realName: '待删除学生',
        role: 'student'
      });
      const id = created.body.data.id;

      const deleted = await ctx.agent.delete(`/api/users/${id}`).set(ctx.auth('admin'));
      expect(deleted.status).toBe(200);
      expect(deleted.body.data).toEqual({ id });

      const list = await ctx.agent.get('/api/users?keyword=student12').set(ctx.auth('admin'));
      expect(list.body.data.total).toBe(0);

      const again = await ctx.agent.delete(`/api/users/${id}`).set(ctx.auth('admin'));
      expect(again.status).toBe(404);
      expect(again.body.code).toBe(40401);
    });

    it('TC-API-16 删除存在关联数据的用户返回 409/40901', async () => {
      const res = await ctx.agent.delete(`/api/users/${ctx.users.teacher.id}`).set(ctx.auth('admin'));
      expect(res.status).toBe(409);
      expect(res.body.code).toBe(40901);
      expect(res.body.message).toContain('关联数据');
    });
  });

  // ---------------------------------------------------------------------------
  // §5.4 课程
  // ---------------------------------------------------------------------------
  describe('§5.4 课程管理', () => {
    it('TC-API-17 课程列表按角色范围过滤，返回字段完整', async () => {
      const admin = await ctx.agent.get('/api/courses').set(ctx.auth('admin'));
      expect(admin.status).toBe(200);
      expect(admin.body.data).toHaveLength(2);
      expect(admin.body.data[0]).toMatchObject({
        id: 1,
        name: '数据结构',
        code: 'CS201',
        teacherId: ctx.users.teacher.id
      });
      expect(admin.body.data[0].createdAt).toMatch(TIME_PATTERN);

      const teacher = await ctx.agent.get('/api/courses').set(ctx.auth('teacher'));
      expect(teacher.body.data).toHaveLength(2);
      expect(teacher.body.data.every((item) => item.teacherId === ctx.users.teacher.id)).toBe(true);

      const student = await ctx.agent.get('/api/courses').set(ctx.auth('student'));
      expect(student.body.data).toHaveLength(2);
    });

    it('TC-API-18 创建课程：管理员可指定教师，教师传入他人 teacherId 被强制为本人', async () => {
      const byAdmin = await ctx.agent.post('/api/courses').set(ctx.auth('admin')).send({
        name: '操作系统',
        code: 'CS203',
        description: '进程与内存管理',
        teacherId: ctx.users.teacher.id
      });
      expect(byAdmin.status).toBe(201);
      expect(byAdmin.body.data.teacherId).toBe(ctx.users.teacher.id);

      const byTeacher = await ctx.agent.post('/api/courses').set(ctx.auth('teacher')).send({
        name: '离散数学',
        code: 'MA101',
        teacherId: ctx.users.admin.id
      });
      expect(byTeacher.status).toBe(201);
      expect(byTeacher.body.data.teacherId).toBe(ctx.users.teacher.id);
    });

    it('TC-API-19 创建课程异常：代码重复 409、缺字段 400、学生 403', async () => {
      const conflict = await ctx.agent.post('/api/courses').set(ctx.auth('teacher')).send({
        name: '重复课程',
        code: 'CS201'
      });
      expect(conflict.status).toBe(409);
      expect(conflict.body).toEqual({ code: 40901, message: '课程代码已存在' });

      const missing = await ctx.agent.post('/api/courses').set(ctx.auth('admin')).send({
        name: '缺代码课程'
      });
      expect(missing.status).toBe(400);
      expect(missing.body.code).toBe(40001);
      expect(missing.body.message).toContain('课程代码');

      const student = await ctx.agent.post('/api/courses').set(ctx.auth('student')).send({
        name: '非法课程',
        code: 'XX001'
      });
      expect(student.status).toBe(403);
      expect(student.body.code).toBe(40301);
    });

    it('TC-API-20 修改课程：管理员与本人教师可改，他人教师 403，不存在 404', async () => {
      const byAdmin = await ctx.agent
        .put('/api/courses/1')
        .set(ctx.auth('admin'))
        .send({ name: '数据结构（2026 秋）' });
      expect(byAdmin.status).toBe(200);
      expect(byAdmin.body.data.name).toBe('数据结构（2026 秋）');

      const byOwner = await ctx.agent
        .put('/api/courses/1')
        .set(ctx.auth('teacher'))
        .send({ description: '新增实验课' });
      expect(byOwner.status).toBe(200);
      expect(byOwner.body.data.description).toBe('新增实验课');

      const teacher2 = await createTeacher(ctx);
      const other = await ctx.agent.put('/api/courses/1').set(teacher2.auth).send({ name: '篡改' });
      expect(other.status).toBe(403);
      expect(other.body).toEqual({ code: 40301, message: '无权限操作该课程' });

      const notFound = await ctx.agent
        .put('/api/courses/999')
        .set(ctx.auth('admin'))
        .send({ name: '不存在' });
      expect(notFound.status).toBe(404);
    });

    it('TC-API-21 删除课程：有题目 409、仅管理员、不存在 404、空课程可删除', async () => {
      const referenced = await ctx.agent.delete('/api/courses/1').set(ctx.auth('admin'));
      expect(referenced.status).toBe(409);
      expect(referenced.body).toEqual({ code: 40901, message: '该课程下存在题目，无法删除' });

      const byTeacher = await ctx.agent.delete('/api/courses/1').set(ctx.auth('teacher'));
      expect(byTeacher.status).toBe(403);

      const notFound = await ctx.agent.delete('/api/courses/999').set(ctx.auth('admin'));
      expect(notFound.status).toBe(404);

      const created = await ctx.agent.post('/api/courses').set(ctx.auth('admin')).send({
        name: '临时空课程',
        code: 'TMP001',
        teacherId: ctx.users.teacher.id
      });
      const empty = await ctx.agent.delete(`/api/courses/${created.body.data.id}`).set(ctx.auth('admin'));
      expect(empty.status).toBe(200);
      expect(empty.body.data).toEqual({ id: created.body.data.id });
    });
  });

  // ---------------------------------------------------------------------------
  // §5.5 题库
  // ---------------------------------------------------------------------------
  describe('§5.5 题库管理', () => {
    it('TC-API-22 题目列表支持分页与多条件组合过滤', async () => {
      const all = await ctx.agent.get('/api/questions?courseId=1').set(ctx.auth('teacher'));
      expect(all.status).toBe(200);
      expect(all.body.data).toMatchObject({ total: 8, page: 1, pageSize: 10 });
      expect(all.body.data.list.every((item) => item.courseId === 1)).toBe(true);
      expect(all.body.data.list[0].options).toHaveLength(4);

      const single = await ctx.agent.get('/api/questions?courseId=1&type=single').set(ctx.auth('teacher'));
      expect(single.body.data.total).toBe(2);

      const easy = await ctx.agent
        .get('/api/questions?courseId=1&difficulty=1')
        .set(ctx.auth('teacher'));
      expect(easy.body.data.total).toBe(2);
      expect(easy.body.data.list.every((item) => item.difficulty === 1)).toBe(true);

      const keyword = await ctx.agent
        .get(`/api/questions?courseId=1&keyword=${encodeURIComponent('栈')}`)
        .set(ctx.auth('teacher'));
      expect(keyword.body.data.total).toBe(2);

      const paged = await ctx.agent
        .get('/api/questions?courseId=1&page=2&pageSize=3')
        .set(ctx.auth('teacher'));
      expect(paged.body.data.list).toHaveLength(3);
      expect(paged.body.data.page).toBe(2);
    });

    it('TC-API-23 题库越权与不存在：他人课程 403、学生 403、课程不存在 404', async () => {
      const teacher2 = await createTeacher(ctx);
      const other = await ctx.agent.get('/api/questions?courseId=1').set(teacher2.auth);
      expect(other.status).toBe(403);
      expect(other.body.message).toBe('无权限操作该课程');

      const student = await ctx.agent.get('/api/questions').set(ctx.auth('student'));
      expect(student.status).toBe(403);
      expect(student.body.code).toBe(40301);

      const notFound = await ctx.agent.get('/api/questions?courseId=999').set(ctx.auth('teacher'));
      expect(notFound.status).toBe(404);
      expect(notFound.body.code).toBe(40401);
    });

    it('TC-API-24 新增单选与判断题成功，判断题 options 落库为 null', async () => {
      const single = await ctx.agent.post('/api/questions').set(ctx.auth('teacher')).send({
        courseId: 1,
        type: 'single',
        stem: '队列的插入操作在哪一端进行？',
        options: [
          { key: 'A', text: '队头' },
          { key: 'B', text: '队尾' }
        ],
        answer: 'B',
        score: 5,
        difficulty: 2,
        knowledgePoint: '队列',
        analysis: '队列在队尾插入'
      });
      expect(single.status).toBe(201);
      expect(single.body.data).toMatchObject({
        courseId: 1,
        type: 'single',
        answer: 'B',
        score: 5,
        difficulty: 2,
        creatorId: ctx.users.teacher.id
      });

      const judge = await ctx.agent.post('/api/questions').set(ctx.auth('teacher')).send({
        courseId: 1,
        type: 'judge',
        stem: '队列是先进先出的线性表。',
        answer: 'T',
        score: 5,
        difficulty: 1
      });
      expect(judge.status).toBe(201);
      expect(judge.body.data.options).toBeNull();
    });

    it('TC-API-25 题目答案与选项校验：单/多/判断题型非法均返回 400/40001', async () => {
      const base = {
        courseId: 1,
        type: 'single',
        stem: '校验用单选题',
        options: [
          { key: 'A', text: '甲' },
          { key: 'B', text: '乙' }
        ],
        answer: 'A',
        score: 5,
        difficulty: 1
      };
      const cases = [
        { body: { ...base, answer: 'G' }, message: '单选题答案必须为 A~F 的单个字母' },
        { body: { ...base, type: 'multiple', answer: ['A'] }, message: '多选题答案至少包含 2 个选项' },
        { body: { ...base, type: 'multiple', answer: ['A', 'A'] }, message: '多选题答案不能重复' },
        { body: { ...base, type: 'judge', answer: 'TRUE' }, message: '判断题答案必须为 T 或 F' },
        { body: { ...base, options: [{ key: 'A', text: '唯一' }] }, message: '选择题选项至少 2 项' },
        {
          body: {
            ...base,
            options: [
              { key: 'A', text: '一' },
              { key: 'A', text: '二' }
            ]
          },
          message: '选项 key 不能重复'
        },
        { body: { ...base, answer: 'C' }, message: '答案必须存在于选项中' }
      ];
      for (const item of cases) {
        const res = await ctx.agent.post('/api/questions').set(ctx.auth('teacher')).send(item.body);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe(40001);
        expect(res.body.message).toContain(item.message);
      }
    });

    it('TC-API-26 题目分值、难度与简答参考答案校验均返回 400/40001', async () => {
      const judgeBase = {
        courseId: 1,
        type: 'judge',
        stem: '校验用判断题',
        answer: 'T',
        score: 5,
        difficulty: 1
      };
      const zeroScore = await ctx.agent
        .post('/api/questions')
        .set(ctx.auth('teacher'))
        .send({ ...judgeBase, score: 0 });
      expect(zeroScore.status).toBe(400);
      expect(zeroScore.body.message).toContain('分值必须大于 0');

      const badDifficulty = await ctx.agent
        .post('/api/questions')
        .set(ctx.auth('teacher'))
        .send({ ...judgeBase, difficulty: 6 });
      expect(badDifficulty.status).toBe(400);
      expect(badDifficulty.body.message).toBe('参数错误：难度取值范围为 1~5');

      const emptyShort = await ctx.agent.post('/api/questions').set(ctx.auth('teacher')).send({
        courseId: 1,
        type: 'short',
        stem: '简答题',
        answer: '   ',
        score: 10,
        difficulty: 2
      });
      expect(emptyShort.status).toBe(400);
      expect(emptyShort.body.message).toContain('简答题参考答案不能为空');

      const longShort = await ctx.agent.post('/api/questions').set(ctx.auth('teacher')).send({
        courseId: 1,
        type: 'short',
        stem: '简答题',
        answer: '答'.repeat(501),
        score: 10,
        difficulty: 2
      });
      expect(longShort.status).toBe(400);
    });

    it('TC-API-27 修改题目后题库与试卷实时反映，且修改非法答案返回 400', async () => {
      const res = await ctx.agent
        .put('/api/questions/1')
        .set(ctx.auth('teacher'))
        .send({ stem: '顺序表插入元素平均移动多少个元素？', score: 12 });
      expect(res.status).toBe(200);
      expect(res.body.data.stem).toBe('顺序表插入元素平均移动多少个元素？');
      expect(res.body.data.score).toBe(12);
      expect(res.body.data.answer).toBe('B');

      const examDetail = await ctx.agent.get('/api/exams/1').set(ctx.auth('teacher'));
      const inPaper = examDetail.body.data.questions.find((item) => item.questionId === 1);
      expect(inPaper.stem).toBe('顺序表插入元素平均移动多少个元素？');
      expect(inPaper.score).toBe(10);

      const illegal = await ctx.agent
        .put('/api/questions/9')
        .set(ctx.auth('teacher'))
        .send({ answer: 'Z' });
      expect(illegal.status).toBe(400);
      expect(illegal.body.code).toBe(40001);

      const referenced = await ctx.agent
        .put('/api/questions/1')
        .set(ctx.auth('teacher'))
        .send({ answer: 'A' });
      expect(referenced.status).toBe(409);
      expect(referenced.body.code).toBe(40901);
      expect(referenced.body.message).toContain('不能修改题型或答案');

      const notFound = await ctx.agent
        .put('/api/questions/999')
        .set(ctx.auth('teacher'))
        .send({ stem: '不存在' });
      expect(notFound.status).toBe(404);
    });

    it('TC-API-28 删除被试卷引用的题目返回 409，未被引用可删除', async () => {
      const referenced = await ctx.agent.delete('/api/questions/1').set(ctx.auth('teacher'));
      expect(referenced.status).toBe(409);
      expect(referenced.body).toEqual({
        code: 40901,
        message: '该题目已被试卷引用，无法删除'
      });

      const created = await ctx.agent.post('/api/questions').set(ctx.auth('teacher')).send({
        courseId: 1,
        type: 'judge',
        stem: '待删除判断题',
        answer: 'F',
        score: 5,
        difficulty: 1
      });
      const deleted = await ctx.agent
        .delete(`/api/questions/${created.body.data.id}`)
        .set(ctx.auth('teacher'));
      expect(deleted.status).toBe(200);
      expect(deleted.body.data).toEqual({ id: created.body.data.id });

      const notFound = await ctx.agent.delete('/api/questions/999').set(ctx.auth('teacher'));
      expect(notFound.status).toBe(404);
    });

    it('TC-API-29 题目批量导入：合法入库、非法记录 index 与中文原因', async () => {
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
      expect(res.body.code).toBe(0);
      expect(res.body.data.imported).toBe(2);
      expect(res.body.data.failed).toHaveLength(1);
      expect(res.body.data.failed[0].index).toBe(2);
      expect(res.body.data.failed[0].reason).toContain('简答题参考答案不能为空');

      const after = await ctx.agent.get('/api/questions?courseId=1&pageSize=100').set(ctx.auth('teacher'));
      expect(after.body.data.total).toBe(10);
    });

    it('TC-API-30 批量导入异常：空列表 400、课程越权 403、学生 403', async () => {
      const empty = await ctx.agent
        .post('/api/questions/import')
        .set(ctx.auth('teacher'))
        .send({ courseId: 1, questions: [] });
      expect(empty.status).toBe(400);
      expect(empty.body.message).toBe('参数错误：导入题目列表不能为空');

      const teacher2 = await createTeacher(ctx);
      const other = await ctx.agent.post('/api/questions/import').set(teacher2.auth).send({
        courseId: 1,
        questions: [{ type: 'judge', stem: '越权导入', answer: 'T', score: 1, difficulty: 1 }]
      });
      expect(other.status).toBe(403);

      const student = await ctx.agent
        .post('/api/questions/import')
        .set(ctx.auth('student'))
        .send({ courseId: 1, questions: [] });
      expect(student.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // §5.6 考试
  // ---------------------------------------------------------------------------
  describe('§5.6 组卷与考试', () => {
    it('TC-API-31 组卷成功：总分为各题分值之和、状态 draft、题序为 1..n', async () => {
      const created = await createExam(ctx);
      expect(created.status).toBe(201);
      expect(created.body.data).toMatchObject({
        title: '测试考试',
        courseId: 1,
        totalScore: 70,
        passScore: 10,
        status: 'draft',
        questionCount: 6
      });
      expect(created.body.data.startTime).toMatch(TIME_PATTERN);

      const detail = await ctx.agent.get(`/api/exams/${created.body.data.id}`).set(ctx.auth('teacher'));
      expect(detail.body.data.questions.map((item) => item.sortOrder)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(detail.body.data.questions.map((item) => item.score)).toEqual([10, 10, 10, 10, 10, 20]);
    });

    it('TC-API-32 组卷参数校验：空题目、重复题目、跨课程题目、分值为 0 均返回 400', async () => {
      const empty = await createExam(ctx, { questions: [] });
      expect(empty.status).toBe(400);
      expect(empty.body.message).toBe('参数错误：试卷至少包含 1 道题');

      const duplicated = await createExam(ctx, {
        questions: [
          { questionId: 1, score: 10 },
          { questionId: 1, score: 10 }
        ]
      });
      expect(duplicated.status).toBe(400);
      expect(duplicated.body.message).toBe('参数错误：同一题目不能重复加入试卷');

      const crossCourse = await createExam(ctx, { questions: [{ questionId: 9, score: 10 }] });
      expect(crossCourse.status).toBe(400);
      expect(crossCourse.body.message).toBe('参数错误：第 1 题的题目不属于本课程');

      const zeroScore = await createExam(ctx, { questions: [{ questionId: 1, score: 0 }] });
      expect(zeroScore.status).toBe(400);
      expect(zeroScore.body.message).toContain('每题分值必须大于 0');

      const badWindow = await createExam(ctx, {
        startTime: ctx.time(120),
        endTime: ctx.time(60)
      });
      expect(badWindow.status).toBe(400);
      expect(badWindow.body.message).toBe('参数错误：结束时间必须晚于开始时间');
    });

    it('TC-API-33 考试列表支持 status / courseId 过滤，学生访问 403', async () => {
      const all = await ctx.agent.get('/api/exams').set(ctx.auth('teacher'));
      expect(all.status).toBe(200);
      expect(all.body.data).toHaveLength(2);

      const published = await ctx.agent.get('/api/exams?status=published').set(ctx.auth('teacher'));
      expect(published.body.data).toHaveLength(1);
      expect(published.body.data[0].status).toBe('published');

      const byCourse = await ctx.agent.get('/api/exams?courseId=2').set(ctx.auth('teacher'));
      expect(byCourse.body.data).toHaveLength(1);
      expect(byCourse.body.data[0].courseId).toBe(2);

      const admin = await ctx.agent.get('/api/exams').set(ctx.auth('admin'));
      expect(admin.body.data).toHaveLength(2);

      const notFound = await ctx.agent.get('/api/exams?courseId=999').set(ctx.auth('teacher'));
      expect(notFound.status).toBe(404);

      const student = await ctx.agent.get('/api/exams').set(ctx.auth('student'));
      expect(student.status).toBe(403);
    });

    it('TC-API-34 试卷详情含答案与解析、指派人数，学生与越权教师 403', async () => {
      const detail = await ctx.agent.get('/api/exams/1').set(ctx.auth('teacher'));
      expect(detail.status).toBe(200);
      expect(detail.body.data).toMatchObject({
        title: '数据结构期中考试',
        totalScore: 100,
        passScore: 60,
        status: 'published',
        questionCount: 8,
        assignedCount: 2
      });
      expect(detail.body.data.questions[0]).toMatchObject({
        questionId: 1,
        type: 'single',
        answer: 'B',
        score: 10,
        sortOrder: 1
      });
      expect(detail.body.data.questions[0].analysis).toBeTruthy();

      const student = await ctx.agent.get('/api/exams/1').set(ctx.auth('student'));
      expect(student.status).toBe(403);

      const teacher2 = await createTeacher(ctx);
      const other = await ctx.agent.get('/api/exams/1').set(teacher2.auth);
      expect(other.status).toBe(403);
      expect(other.body.message).toBe('无权限操作该考试');

      const notFound = await ctx.agent.get('/api/exams/999').set(ctx.auth('teacher'));
      expect(notFound.status).toBe(404);
    });

    it('TC-API-35 草稿考试可修改并整体替换题目，已发布考试修改返回 409', async () => {
      const created = await createExam(ctx);
      const examId = created.body.data.id;

      const updated = await ctx.agent
        .put(`/api/exams/${examId}`)
        .set(ctx.auth('teacher'))
        .send({ title: '修改后的考试', questions: [{ questionId: 1, score: 30 }, { questionId: 7, score: 20 }] });
      expect(updated.status).toBe(200);
      expect(updated.body.data).toMatchObject({ title: '修改后的考试', totalScore: 50, questionCount: 2 });

      const detail = await ctx.agent.get(`/api/exams/${examId}`).set(ctx.auth('teacher'));
      expect(detail.body.data.questions.map((item) => item.questionId)).toEqual([1, 7]);
      expect(detail.body.data.questions.map((item) => item.sortOrder)).toEqual([1, 2]);

      const published = await ctx.agent
        .put('/api/exams/1')
        .set(ctx.auth('teacher'))
        .send({ title: '试图修改已发布考试' });
      expect(published.status).toBe(409);
      expect(published.body.code).toBe(40901);

      const notFound = await ctx.agent.put('/api/exams/999').set(ctx.auth('teacher')).send({ title: 'x' });
      expect(notFound.status).toBe(404);
    });

    it('TC-API-36 删除考试：草稿可删，已发布 409，学生 403', async () => {
      const created = await createExam(ctx);
      const examId = created.body.data.id;
      const deleted = await ctx.agent.delete(`/api/exams/${examId}`).set(ctx.auth('teacher'));
      expect(deleted.status).toBe(200);
      expect(deleted.body.data).toEqual({ id: examId });

      const published = await ctx.agent.delete('/api/exams/1').set(ctx.auth('teacher'));
      expect(published.status).toBe(409);
      expect(published.body).toEqual({ code: 40901, message: '仅草稿状态的考试可以删除' });

      const student = await ctx.agent.delete('/api/exams/1').set(ctx.auth('student'));
      expect(student.status).toBe(403);
    });

    it('TC-API-37 发布考试：校验通过后状态为 published，重复发布 409，及格线超总分 400', async () => {
      const created = await createExam(ctx);
      const res = await ctx.agent
        .post(`/api/exams/${created.body.data.id}/publish`)
        .set(ctx.auth('teacher'));
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ status: 'published', totalScore: 70, questionCount: 6 });

      const again = await ctx.agent.post(`/api/exams/${created.body.data.id}/publish`).set(ctx.auth('teacher'));
      expect(again.status).toBe(409);
      expect(again.body.message).toBe('仅草稿状态的考试可以发布');

      const invalid = await createExam(ctx, { passScore: 1000 });
      const failed = await ctx.agent
        .post(`/api/exams/${invalid.body.data.id}/publish`)
        .set(ctx.auth('teacher'));
      expect(failed.status).toBe(400);
      expect(failed.body).toEqual({ code: 40001, message: '发布失败：及格线不能大于试卷总分' });

      const notFound = await ctx.agent.post('/api/exams/999/publish').set(ctx.auth('teacher'));
      expect(notFound.status).toBe(404);
    });

    it('TC-API-38 指派考生为覆盖式并自动去重，空数组清空指派', async () => {
      const created = await createExam(ctx);
      const examId = created.body.data.id;

      const first = await ctx.agent
        .post(`/api/exams/${examId}/assign`)
        .set(ctx.auth('teacher'))
        .send({ studentIds: [ctx.users.student.id, ctx.users.student2.id, ctx.users.student.id] });
      expect(first.status).toBe(200);
      expect(first.body.data).toMatchObject({ examId, assignedCount: 2 });

      const second = await ctx.agent
        .post(`/api/exams/${examId}/assign`)
        .set(ctx.auth('teacher'))
        .send({ studentIds: [ctx.users.student2.id] });
      expect(second.body.data.assignedCount).toBe(1);

      const detail = await ctx.agent.get(`/api/exams/${examId}`).set(ctx.auth('teacher'));
      expect(detail.body.data.assignedCount).toBe(1);

      const cleared = await ctx.agent
        .post(`/api/exams/${examId}/assign`)
        .set(ctx.auth('teacher'))
        .send({ studentIds: [] });
      expect(cleared.status).toBe(200);
      expect(cleared.body.data.assignedCount).toBe(0);
    });

    it('TC-API-39 指派考生异常：非学生 400、不存在 400、越权教师 403、考试不存在 404', async () => {
      const created = await createExam(ctx);
      const examId = created.body.data.id;

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

      const teacher2 = await createTeacher(ctx);
      const other = await ctx.agent
        .post(`/api/exams/${examId}/assign`)
        .set(teacher2.auth)
        .send({ studentIds: [ctx.users.student.id] });
      expect(other.status).toBe(403);

      const notFound = await ctx.agent
        .post('/api/exams/999/assign')
        .set(ctx.auth('teacher'))
        .send({ studentIds: [] });
      expect(notFound.status).toBe(404);
    });

    it('TC-API-40 学生可考列表只含已发布且被指派的考试，并带 attemptStatus', async () => {
      const res = await ctx.agent.get('/api/exams/available').set(ctx.auth('student'));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({
        id: 1,
        title: '数据结构期中考试',
        courseId: 1,
        status: 'published',
        totalScore: 100,
        passScore: 60,
        // 实现口径为 none；需求 FR-23 记为 not_started，见缺陷 D-03
        attemptStatus: 'none',
        attemptId: null,
        totalScoreObtained: null
      });

      const submitted = await ctx.agent.get('/api/exams/available').set(ctx.auth('student2'));
      expect(submitted.body.data[0]).toMatchObject({
        id: 1,
        attemptStatus: 'submitted',
        attemptId: 1,
        totalScoreObtained: 50
      });

      const teacher = await ctx.agent.get('/api/exams/available').set(ctx.auth('teacher'));
      expect(teacher.status).toBe(403);
    });

    it('TC-API-41 考生试卷不含答案与解析，未指派 403、未发布 409、教师 403', async () => {
      const res = await ctx.agent.get('/api/exams/1/paper').set(ctx.auth('student'));
      expect(res.status).toBe(200);
      expect(res.body.data.exam).toMatchObject({ id: 1, title: '数据结构期中考试', totalScore: 100 });
      expect(res.body.data.questions).toHaveLength(8);
      expect(res.body.data.questions[0]).toMatchObject({ questionId: 1, type: 'single', score: 10 });
      expect(res.body.data.questions[0]).not.toHaveProperty('answer');
      expect(res.body.data.questions[0]).not.toHaveProperty('analysis');
      expect(JSON.stringify(res.body.data)).not.toContain('"answer"');
      expect(JSON.stringify(res.body.data)).not.toContain('"analysis"');
      expect(res.body.data.attempt).toBeNull();

      const unassigned = await createPublishedExam(ctx, { assignTo: ['student2'] });
      const forbidden = await ctx.agent.get(`/api/exams/${unassigned.examId}/paper`).set(ctx.auth('student'));
      expect(forbidden.status).toBe(403);
      expect(forbidden.body).toEqual({ code: 40301, message: '您未被指派该考试' });

      const draft = await ctx.agent.get('/api/exams/2/paper').set(ctx.auth('student'));
      expect(draft.status).toBe(409);
      expect(draft.body.message).toBe('考试尚未发布');

      const teacher = await ctx.agent.get('/api/exams/1/paper').set(ctx.auth('teacher'));
      expect(teacher.status).toBe(403);
    });

    it('TC-API-42 开考返回 201 与截止时间，重复开考返回原答卷且不新增记录', async () => {
      const started = await startAttempt(ctx, 1);
      expect(started.status).toBe(201);
      expect(started.body.data.attemptId).toBeGreaterThan(0);
      expect(started.body.data.remainingSeconds).toBe(5400);
      expect(started.body.data.deadlineAt).toMatch(TIME_PATTERN);

      const again = await startAttempt(ctx, 1);
      expect(again.status).toBe(200);
      expect(again.body.data.attemptId).toBe(started.body.data.attemptId);
      expect(again.body.data.deadlineAt).toBe(started.body.data.deadlineAt);

      const rows = await ctx.repos.attempts.listByExamIds([1]);
      expect(rows.filter((item) => item.studentId === ctx.users.student.id)).toHaveLength(1);
    });

    it('TC-API-43 开考异常：未指派 403、未发布 409、窗口外 409、已交卷 409', async () => {
      const draft = await startAttempt(ctx, 2);
      expect(draft.status).toBe(409);
      expect(draft.body.message).toBe('考试尚未发布');

      const unassigned = await createPublishedExam(ctx, { assignTo: ['student2'] });
      const forbidden = await startAttempt(ctx, unassigned.examId);
      expect(forbidden.status).toBe(403);
      expect(forbidden.body.code).toBe(40301);

      const earlyExam = await createPublishedExam(ctx, {
        startTime: ctx.time(30),
        endTime: ctx.time(120)
      });
      const early = await startAttempt(ctx, earlyExam.examId);
      expect(early.status).toBe(409);
      expect(early.body.message).toBe('考试尚未开始');

      const lateExam = await createPublishedExam(ctx, {
        startTime: ctx.time(-120),
        endTime: ctx.time(-60)
      });
      const late = await startAttempt(ctx, lateExam.examId);
      expect(late.status).toBe(409);
      expect(late.body.message).toBe('考试已结束');

      const submittedAgain = await startAttempt(ctx, 1, 'student2');
      expect(submittedAgain.status).toBe(409);
      expect(submittedAgain.body.code).toBe(40901);
    });
  });

  // ---------------------------------------------------------------------------
  // §5.7 答题与交卷
  // ---------------------------------------------------------------------------
  describe('§5.7 答题与交卷', () => {
    /** 开考默认考试（课程 1，6 题 70 分）并返回 attemptId */
    async function startDefaultAttempt() {
      const { examId } = await createPublishedExam(ctx);
      const started = await startAttempt(ctx, examId);
      return { examId, attemptId: started.body.data.attemptId };
    }

    it('TC-API-44 答卷详情返回题目、已保存答案与剩余秒数，且不含标准答案', async () => {
      const { attemptId } = await startDefaultAttempt();
      const res = await ctx.agent.get(`/api/attempts/${attemptId}`).set(ctx.auth('student'));
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        attemptId,
        status: 'in_progress',
        remainingSeconds: 3600,
        totalScore: null
      });
      expect(res.body.data.deadlineAt).toMatch(TIME_PATTERN);
      expect(res.body.data.questions).toHaveLength(6);
      expect(res.body.data.questions[0]).toMatchObject({ questionId: 1, type: 'single', score: 10 });
      expect(res.body.data.questions[0].savedAnswer).toBeNull();
      expect(res.body.data.questions[0]).not.toHaveProperty('answer');
      expect(JSON.stringify(res.body.data)).not.toContain('"analysis"');
    });

    it('TC-API-45 答卷详情权限：他人 403、教师本人课程 200、管理员 403、不存在 404', async () => {
      const other = await ctx.agent.get('/api/attempts/1').set(ctx.auth('student'));
      expect(other.status).toBe(403);
      expect(other.body.code).toBe(40301);

      const teacher = await ctx.agent.get('/api/attempts/1').set(ctx.auth('teacher'));
      expect(teacher.status).toBe(200);
      expect(teacher.body.data.status).toBe('submitted');

      const admin = await ctx.agent.get('/api/attempts/1').set(ctx.auth('admin'));
      expect(admin.status).toBe(403);

      const notFound = await ctx.agent.get('/api/attempts/999').set(ctx.auth('teacher'));
      expect(notFound.status).toBe(404);
      expect(notFound.body.code).toBe(40401);
    });

    it('TC-API-46 单题自动保存为 upsert，answer=null 可清空作答', async () => {
      const { attemptId } = await startDefaultAttempt();

      const single = await ctx.agent
        .put(`/api/attempts/${attemptId}/answers`)
        .set(ctx.auth('student'))
        .send({ questionId: 1, answer: 'B' });
      expect(single.status).toBe(200);
      expect(single.body.data.questionId).toBe(1);
      expect(single.body.data.savedAt).toMatch(TIME_PATTERN);

      const multiple = await ctx.agent
        .put(`/api/attempts/${attemptId}/answers`)
        .set(ctx.auth('student'))
        .send({ questionId: 3, answer: ['C', 'A'] });
      expect(multiple.status).toBe(200);

      const updated = await ctx.agent
        .put(`/api/attempts/${attemptId}/answers`)
        .set(ctx.auth('student'))
        .send({ questionId: 1, answer: 'A' });
      expect(updated.status).toBe(200);

      const restored = await ctx.agent.get(`/api/attempts/${attemptId}`).set(ctx.auth('student'));
      const map = new Map(restored.body.data.questions.map((item) => [item.questionId, item]));
      expect(map.get(1).savedAnswer).toBe('A');
      expect(map.get(3).savedAnswer).toEqual(['C', 'A']);
      expect(await ctx.repos.answers.listByAttempt(attemptId)).toHaveLength(2);

      const cleared = await ctx.agent
        .put(`/api/attempts/${attemptId}/answers`)
        .set(ctx.auth('student'))
        .send({ questionId: 1, answer: null });
      expect(cleared.status).toBe(200);
      const afterClear = await ctx.agent.get(`/api/attempts/${attemptId}`).set(ctx.auth('student'));
      const clearedMap = new Map(afterClear.body.data.questions.map((item) => [item.questionId, item]));
      expect(clearedMap.get(1).savedAnswer).toBeNull();
      expect(await ctx.repos.answers.listByAttempt(attemptId)).toHaveLength(2);
    });

    it('TC-API-47 自动保存异常：题目不属于本卷 400、结构非法 400、非本人 403、交卷后 409', async () => {
      const { attemptId } = await startDefaultAttempt();

      const unrelated = await ctx.agent
        .put(`/api/attempts/${attemptId}/answers`)
        .set(ctx.auth('student'))
        .send({ questionId: 9, answer: 'B' });
      expect(unrelated.status).toBe(400);
      expect(unrelated.body.message).toBe('参数错误：该题目不属于本场考试');

      const wrongShape = await ctx.agent
        .put(`/api/attempts/${attemptId}/answers`)
        .set(ctx.auth('student'))
        .send({ questionId: 3, answer: 'AC' });
      expect(wrongShape.status).toBe(400);
      expect(wrongShape.body.code).toBe(40001);

      const otherStudent = await ctx.agent
        .put(`/api/attempts/${attemptId}/answers`)
        .set(ctx.auth('student2'))
        .send({ questionId: 1, answer: 'B' });
      expect(otherStudent.status).toBe(403);

      await ctx.agent.post(`/api/attempts/${attemptId}/submit`).set(ctx.auth('student'));
      const afterSubmit = await ctx.agent
        .put(`/api/attempts/${attemptId}/answers`)
        .set(ctx.auth('student'))
        .send({ questionId: 1, answer: 'B' });
      expect(afterSubmit.status).toBe(409);
      expect(afterSubmit.body).toEqual({ code: 40901, message: '答卷已提交，不能继续作答' });
    });

    it('TC-API-48 交卷自动判分并返回总分、客观分与待阅数量', async () => {
      const { attemptId } = await startDefaultAttempt();
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

      const res = await ctx.agent.post(`/api/attempts/${attemptId}/submit`).set(ctx.auth('student'));
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ totalScore: 40, objectiveScore: 40, subjectivePending: 1 });

      const attempt = await ctx.agent.get(`/api/attempts/${attemptId}`).set(ctx.auth('student'));
      expect(attempt.body.data.status).toBe('submitted');
      expect(attempt.body.data.remainingSeconds).toBe(0);
      expect(attempt.body.data.totalScore).toBe(40);
    });

    it('TC-API-49 重复交卷幂等：总分与交卷时间不变', async () => {
      const { attemptId } = await startDefaultAttempt();
      await ctx.agent
        .put(`/api/attempts/${attemptId}/answers`)
        .set(ctx.auth('student'))
        .send({ questionId: 1, answer: 'B' });

      const first = await ctx.agent.post(`/api/attempts/${attemptId}/submit`).set(ctx.auth('student'));
      const firstRow = await ctx.repos.attempts.findById(attemptId);
      const second = await ctx.agent.post(`/api/attempts/${attemptId}/submit`).set(ctx.auth('student'));
      const secondRow = await ctx.repos.attempts.findById(attemptId);

      expect(second.status).toBe(200);
      expect(second.body.data).toEqual(first.body.data);
      expect(secondRow.totalScore).toBe(firstRow.totalScore);
      expect(secondRow.submittedAt).toBe(firstRow.submittedAt);
    });

    it('TC-API-50 成绩详情返回逐题得分、正确答案、解析与及格判定', async () => {
      const { attemptId } = await startDefaultAttempt();
      await ctx.agent
        .put(`/api/attempts/${attemptId}/answers`)
        .set(ctx.auth('student'))
        .send({ questionId: 1, answer: 'B' });
      await ctx.agent
        .put(`/api/attempts/${attemptId}/answers`)
        .set(ctx.auth('student'))
        .send({ questionId: 3, answer: ['A'] });
      await ctx.agent.post(`/api/attempts/${attemptId}/submit`).set(ctx.auth('student'));

      const res = await ctx.agent.get(`/api/attempts/${attemptId}/result`).set(ctx.auth('student'));
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        status: 'submitted',
        totalScore: 10,
        objectiveScore: 10,
        subjectiveScore: 0,
        examTotalScore: 70,
        passScore: 10,
        passed: true
      });
      expect(res.body.data.items).toHaveLength(6);
      const map = new Map(res.body.data.items.map((item) => [item.questionId, item]));
      expect(map.get(1)).toMatchObject({
        myAnswer: 'B',
        correctAnswer: 'B',
        score: 10,
        fullScore: 10
      });
      expect(map.get(3)).toMatchObject({ myAnswer: ['A'], correctAnswer: ['A', 'C'], score: 0 });
      expect(map.get(7).myAnswer).toBeNull();
      expect(map.get(7).score).toBe(0);
      expect(map.get(7).analysis).toBeTruthy();
    });

    it('TC-API-51 成绩详情异常：未交卷 409、他人 403、不存在 404、管理员可查', async () => {
      const { attemptId } = await startDefaultAttempt();
      const inProgress = await ctx.agent
        .get(`/api/attempts/${attemptId}/result`)
        .set(ctx.auth('student'));
      expect(inProgress.status).toBe(409);
      expect(inProgress.body.code).toBe(40901);

      const other = await ctx.agent.get('/api/attempts/1/result').set(ctx.auth('student'));
      expect(other.status).toBe(403);

      const notFound = await ctx.agent.get('/api/attempts/999/result').set(ctx.auth('admin'));
      expect(notFound.status).toBe(404);

      const admin = await ctx.agent.get('/api/attempts/1/result').set(ctx.auth('admin'));
      expect(admin.status).toBe(200);
      expect(admin.body.data.totalScore).toBe(50);
    });
  });

  // ---------------------------------------------------------------------------
  // §5.8 阅卷
  // ---------------------------------------------------------------------------
  describe('§5.8 阅卷', () => {
    it('TC-API-52 待阅列表返回待评简答题数量，可按 examId 过滤', async () => {
      const all = await ctx.agent.get('/api/grading/pending').set(ctx.auth('teacher'));
      expect(all.status).toBe(200);
      expect(all.body.data).toHaveLength(1);
      expect(all.body.data[0]).toMatchObject({
        attemptId: 1,
        studentName: '王小红',
        pendingCount: 2
      });
      expect(all.body.data[0].submittedAt).toMatch(TIME_PATTERN);

      const scoped = await ctx.agent.get('/api/grading/pending?examId=1').set(ctx.auth('teacher'));
      expect(scoped.body.data).toHaveLength(1);

      const empty = await ctx.agent.get('/api/grading/pending?examId=2').set(ctx.auth('teacher'));
      expect(empty.body.data).toEqual([]);

      const student = await ctx.agent.get('/api/grading/pending').set(ctx.auth('student'));
      expect(student.status).toBe(403);
    });

    it('TC-API-53 阅卷详情含参考答案、学生作答与待评标记', async () => {
      const res = await ctx.agent.get('/api/grading/1').set(ctx.auth('teacher'));
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        attemptId: 1,
        examTitle: '数据结构期中考试',
        studentName: '王小红',
        status: 'submitted',
        objectiveScore: 50,
        pendingCount: 2
      });
      const map = new Map(res.body.data.items.map((item) => [item.questionId, item]));
      expect(map.get(1)).toMatchObject({
        type: 'single',
        correctAnswer: 'B',
        studentAnswer: 'B',
        fullScore: 10,
        score: 10,
        needGrading: false
      });
      expect(map.get(3)).toMatchObject({
        studentAnswer: ['A'],
        correctAnswer: ['A', 'C'],
        score: 0
      });
      expect(map.get(7).needGrading).toBe(true);

      const student = await ctx.agent.get('/api/grading/1').set(ctx.auth('student'));
      expect(student.status).toBe(403);

      const notFound = await ctx.agent.get('/api/grading/999').set(ctx.auth('teacher'));
      expect(notFound.status).toBe(404);
    });

    it('TC-API-54 阅卷评分重算总分、状态置 graded，学生成绩同步', async () => {
      const res = await ctx.agent
        .post('/api/grading/1')
        .set(ctx.auth('teacher'))
        .send({
          items: [
            { questionId: 7, score: 20, comment: '要点完整' },
            { questionId: 8, score: 15 }
          ]
        });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        attemptId: 1,
        status: 'graded',
        objectiveScore: 50,
        subjectiveScore: 35,
        totalScore: 85,
        pendingCount: 0
      });

      const result = await ctx.agent.get('/api/attempts/1/result').set(ctx.auth('student2'));
      expect(result.body.data).toMatchObject({ status: 'graded', totalScore: 85, passed: true });
      const q7 = result.body.data.items.find((item) => item.questionId === 7);
      expect(q7.score).toBe(20);
      expect(q7.comment).toBe('要点完整');

      const pending = await ctx.agent.get('/api/grading/pending').set(ctx.auth('teacher'));
      expect(pending.body.data).toEqual([]);
    });

    it('TC-API-55 阅卷异常：越界 400、非简答题 400、未交卷 409、越权 403', async () => {
      const tooHigh = await ctx.agent
        .post('/api/grading/1')
        .set(ctx.auth('teacher'))
        .send({ items: [{ questionId: 7, score: 21 }] });
      expect(tooHigh.status).toBe(400);
      expect(tooHigh.body.message).toBe('参数错误：第 1 项分数必须在 0~20 之间');

      const objective = await ctx.agent
        .post('/api/grading/1')
        .set(ctx.auth('teacher'))
        .send({ items: [{ questionId: 1, score: 5 }] });
      expect(objective.status).toBe(400);
      expect(objective.body.message).toBe('参数错误：只能对简答题评分');

      const emptyItems = await ctx.agent
        .post('/api/grading/1')
        .set(ctx.auth('teacher'))
        .send({ items: [] });
      expect(emptyItems.status).toBe(400);
      expect(emptyItems.body.message).toBe('参数错误：评分项不能为空');

      const { examId } = await createPublishedExam(ctx);
      const fresh = (await startAttempt(ctx, examId)).body.data.attemptId;
      const notSubmitted = await ctx.agent.get(`/api/grading/${fresh}`).set(ctx.auth('teacher'));
      expect(notSubmitted.status).toBe(409);

      const teacher2 = await createTeacher(ctx);
      const forbidden = await ctx.agent
        .post('/api/grading/1')
        .set(teacher2.auth)
        .send({ items: [{ questionId: 7, score: 10 }] });
      expect(forbidden.status).toBe(403);

      const notFound = await ctx.agent
        .post('/api/grading/999')
        .set(ctx.auth('teacher'))
        .send({ items: [{ questionId: 7, score: 1 }] });
      expect(notFound.status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------------
  // §5.9 统计
  // ---------------------------------------------------------------------------
  describe('§5.9 统计', () => {
    it('TC-API-56 管理员全局概览返回 7 项计数，教师与学生 403', async () => {
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

      const teacher = await ctx.agent.get('/api/stats/overview').set(ctx.auth('teacher'));
      expect(teacher.status).toBe(403);
      const student = await ctx.agent.get('/api/stats/overview').set(ctx.auth('student'));
      expect(student.status).toBe(403);
    });

    it('TC-API-57 考试统计列表按教师范围返回场次摘要，count 仅统计已交卷', async () => {
      const res = await ctx.agent.get('/api/stats/exams').set(ctx.auth('teacher'));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      const midterm = res.body.data.find((item) => item.examId === 1);
      expect(midterm).toMatchObject({
        title: '数据结构期中考试',
        status: 'published',
        count: 1,
        avg: 50,
        max: 50,
        min: 50,
        passRate: 0
      });
      const draft = res.body.data.find((item) => item.examId === 2);
      expect(draft).toMatchObject({ count: 0, avg: 0, passRate: 0 });

      const admin = await ctx.agent.get('/api/stats/exams').set(ctx.auth('admin'));
      expect(admin.body.data).toHaveLength(2);

      const student = await ctx.agent.get('/api/stats/exams').set(ctx.auth('student'));
      expect(student.status).toBe(403);
    });

    it('TC-API-58 单场考试统计返回五段分布与逐题正确率', async () => {
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
      expect(res.body.data.distribution.reduce((sum, item) => sum + item.count, 0)).toBe(1);
      expect(res.body.data.questions).toHaveLength(8);
      const map = new Map(res.body.data.questions.map((item) => [item.questionId, item]));
      expect(map.get(1)).toMatchObject({ type: 'single', avgScore: 10 });
      expect(map.get(3)).toMatchObject({ type: 'multiple', avgScore: 0 });
      expect(map.get(7)).toMatchObject({ type: 'short', avgScore: 0 });
      for (const item of res.body.data.questions) {
        // accuracy 量纲见缺陷 D-05：实现为百分数
        expect(Number.isFinite(item.accuracy)).toBe(true);
        expect(item.accuracy).toBeGreaterThanOrEqual(0);
      }
    });

    it('TC-API-59 统计异常：考试不存在 404、教师越权 403', async () => {
      const notFound = await ctx.agent.get('/api/stats/exams/999').set(ctx.auth('teacher'));
      expect(notFound.status).toBe(404);
      expect(notFound.body.code).toBe(40401);

      const teacher2 = await createTeacher(ctx);
      const forbidden = await ctx.agent.get('/api/stats/exams/1').set(teacher2.auth);
      expect(forbidden.status).toBe(403);
      expect(forbidden.body.message).toBe('无权限操作该考试');
    });

    it('TC-API-60 学生个人成绩：本人可查、他人 403、管理员 403、非学生 400', async () => {
      const mine = await ctx.agent
        .get(`/api/stats/students/${ctx.users.student2.id}`)
        .set(ctx.auth('student2'));
      expect(mine.status).toBe(200);
      expect(mine.body.data).toMatchObject({
        studentId: ctx.users.student2.id,
        studentName: '王小红',
        count: 1,
        avg: 50
      });
      expect(mine.body.data.list[0]).toMatchObject({
        attemptId: 1,
        examId: 1,
        examTitle: '数据结构期中考试',
        fullScore: 100,
        passScore: 60,
        totalScore: 50,
        status: 'submitted'
      });
      expect(mine.body.data.list[0].submittedAt).toMatch(TIME_PATTERN);

      const empty = await ctx.agent
        .get(`/api/stats/students/${ctx.users.student.id}`)
        .set(ctx.auth('student'));
      expect(empty.body.data).toMatchObject({ count: 0, avg: 0, list: [] });

      const other = await ctx.agent
        .get(`/api/stats/students/${ctx.users.student2.id}`)
        .set(ctx.auth('student'));
      expect(other.status).toBe(403);

      const admin = await ctx.agent
        .get(`/api/stats/students/${ctx.users.student.id}`)
        .set(ctx.auth('admin'));
      expect(admin.status).toBe(403);

      const notStudent = await ctx.agent
        .get(`/api/stats/students/${ctx.users.teacher.id}`)
        .set(ctx.auth('teacher'));
      expect(notStudent.status).toBe(400);

      const notFound = await ctx.agent.get('/api/stats/students/999').set(ctx.auth('teacher'));
      expect(notFound.status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------------
  // NFR-04 / NFR-05 / NFR-06 安全与契约约束
  // ---------------------------------------------------------------------------
  describe('NFR-04 / NFR-05 / NFR-06 安全约束', () => {
    it('TC-API-61 令牌 payload 含 sub/username/role，有效期为 8 小时', async () => {
      const res = await ctx.agent
        .post('/api/auth/login')
        .send({ username: 'student01', password: 'Stu@123' });
      const payload = jwt.decode(res.body.data.token);
      expect(payload.sub).toBe(ctx.users.student.id);
      expect(payload.username).toBe('student01');
      expect(payload.role).toBe('student');
      expect(payload.exp - payload.iat).toBe(8 * 60 * 60);
    });

    it('TC-API-62 口令以 bcrypt cost=10 散列存储，响应不回传密码字段', async () => {
      const row = await ctx.repos.users.findByUsername('admin');
      expect(row.passwordHash).toMatch(/^\$2[aby]\$10\$/);

      const list = await ctx.agent.get('/api/users').set(ctx.auth('admin'));
      expect(JSON.stringify(list.body)).not.toContain('passwordHash');
      expect(JSON.stringify(list.body)).not.toContain('password_hash');
    });

    it('TC-API-63 SQL 注入串不产生 5xx，也不返回越权数据', async () => {
      const payloads = [
        "' OR 1=1 --",
        "'; DROP TABLE users; --",
        "%' UNION SELECT password_hash FROM users --"
      ];
      for (const payload of payloads) {
        const users = await ctx.agent
          .get(`/api/users?keyword=${encodeURIComponent(payload)}`)
          .set(ctx.auth('admin'));
        expect(users.status).toBe(200);
        expect(users.body.data.total).toBe(0);

        const questions = await ctx.agent
          .get(`/api/questions?keyword=${encodeURIComponent(payload)}`)
          .set(ctx.auth('teacher'));
        expect(questions.status).toBe(200);
        expect(questions.body.data.total).toBe(0);
      }

      const login = await ctx.agent
        .post('/api/auth/login')
        .send({ username: "' OR 1=1 --", password: 'x' });
      expect(login.status).toBe(401);
      expect(login.body.code).toBe(40101);

      const after = await ctx.agent.get('/api/users').set(ctx.auth('admin'));
      expect(after.body.data.total).toBe(4);
    });
  });
});
