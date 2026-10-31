'use strict';

const request = require('supertest');
const createApp = require('../src/app');
const { createMemoryRepositories } = require('../src/repositories');
const { seedMemory } = require('../src/db/seed');
const { loadConfig } = require('../src/config');
const { formatDateTime } = require('../src/utils/time');

const BASE_CONFIG = {
  ...loadConfig(),
  env: 'test',
  driver: 'memory',
  jwtSecret: 'test-secret'
};

/**
 * 创建一套独立的测试上下文：内存仓储 + 种子数据 + 注入假时钟 + 各角色令牌。
 * 每个 it 使用独立上下文，避免测试之间相互污染。
 */
async function createTestContext() {
  const repos = createMemoryRepositories();
  await seedMemory(repos);

  let current = new Date();
  const clock = () => new Date(current);
  const app = createApp({ repos, config: BASE_CONFIG, clock });
  const agent = request(app);

  const accounts = {
    admin: ['admin', 'Admin@123'],
    teacher: ['teacher01', 'Teach@123'],
    student: ['student01', 'Stu@123'],
    student2: ['student02', 'Stu@123']
  };
  const tokens = {};
  const users = {};
  for (const [key, [username, password]] of Object.entries(accounts)) {
    const res = await agent.post('/api/auth/login').send({ username, password });
    if (res.status !== 200) {
      throw new Error(`测试上下文登录失败：${username} ${res.status} ${JSON.stringify(res.body)}`);
    }
    tokens[key] = res.body.data.token;
    users[key] = res.body.data.user;
  }

  return {
    app,
    agent,
    repos,
    config: BASE_CONFIG,
    tokens,
    users,
    auth: (key) => ({ Authorization: `Bearer ${tokens[key]}` }),
    now: () => new Date(current),
    setNow: (value) => {
      current = value instanceof Date ? new Date(value) : new Date(value);
    },
    advance: (seconds) => {
      current = new Date(current.getTime() + seconds * 1000);
    },
    /** 相对当前（假）时钟的格式化时间 */
    time: (offsetMinutes = 0) =>
      formatDateTime(new Date(current.getTime() + offsetMinutes * 60 * 1000))
  };
}

/** 通过接口创建考试（默认归属课程 1） */
async function createExam(ctx, overrides = {}) {
  const payload = {
    title: '测试考试',
    courseId: 1,
    description: '自动化测试用考试',
    startTime: ctx.time(-10),
    endTime: ctx.time(120),
    durationMin: 60,
    passScore: 10,
    shuffle: false,
    questions: [
      { questionId: 1, score: 10 },
      { questionId: 2, score: 10 },
      { questionId: 3, score: 10 },
      { questionId: 5, score: 10 },
      { questionId: 6, score: 10 },
      { questionId: 7, score: 20 }
    ],
    ...overrides
  };
  return ctx.agent.post('/api/exams').set(ctx.auth('teacher')).send(payload);
}

/** 创建并发布考试、指派学生，返回 { examId, exam } */
async function createPublishedExam(ctx, overrides = {}) {
  const created = await createExam(ctx, overrides);
  if (created.status !== 201) {
    throw new Error(`创建考试失败：${created.status} ${JSON.stringify(created.body)}`);
  }
  const examId = created.body.data.id;
  const published = await ctx.agent.post(`/api/exams/${examId}/publish`).set(ctx.auth('teacher'));
  if (published.status !== 200) {
    throw new Error(`发布考试失败：${published.status} ${JSON.stringify(published.body)}`);
  }
  const assignTo = overrides.assignTo || ['student'];
  const studentIds = assignTo.map((key) => ctx.users[key].id);
  const assigned = await ctx.agent
    .post(`/api/exams/${examId}/assign`)
    .set(ctx.auth('teacher'))
    .send({ studentIds });
  if (assigned.status !== 200) {
    throw new Error(`指派学生失败：${assigned.status} ${JSON.stringify(assigned.body)}`);
  }
  return { examId, exam: created.body.data };
}

/** 学生开考 */
async function startAttempt(ctx, examId, studentKey = 'student') {
  return ctx.agent.post(`/api/exams/${examId}/attempts`).set(ctx.auth(studentKey));
}

/** 新建教师并登录（用于越权测试） */
async function createTeacher(ctx, username = 'teacher02', realName = '李老师') {
  const created = await ctx.agent.post('/api/users').set(ctx.auth('admin')).send({
    username,
    password: 'Teach@123',
    realName,
    role: 'teacher'
  });
  const login = await ctx.agent
    .post('/api/auth/login')
    .send({ username, password: 'Teach@123' });
  return {
    user: created.body.data,
    token: login.body.data.token,
    auth: { Authorization: `Bearer ${login.body.data.token}` }
  };
}

module.exports = {
  BASE_CONFIG,
  createTestContext,
  createExam,
  createPublishedExam,
  startAttempt,
  createTeacher
};
