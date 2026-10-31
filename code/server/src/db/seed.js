'use strict';

const { loadConfig } = require('../config');
const { buildSeedData, passwordHash } = require('./seed-data');

/**
 * 按基线第 8 节写入种子数据。仓储方法对 MySQL 与内存实现通用。
 * @param {object} repos 仓储集合
 * @param {{now?: Date}} options
 * @returns {Promise<{users:number,courses:number,questions:number,exams:number,attempts:number}>}
 */
async function seedRepositories(repos, options = {}) {
  const data = buildSeedData(options);

  const existing = await repos.users.findByUsername('admin');
  if (existing) {
    throw new Error('数据库已存在种子数据（admin），请先执行 npm run db:init 重建表');
  }

  const userIds = {};
  for (const item of data.users) {
    const user = await repos.users.create({
      username: item.username,
      passwordHash: passwordHash(item.password),
      realName: item.realName,
      role: item.role,
      email: item.email,
      status: item.status
    });
    userIds[item.key] = user.id;
  }

  const courseIds = {};
  for (const item of data.courses) {
    const course = await repos.courses.create({
      name: item.name,
      code: item.code,
      description: item.description,
      teacherId: userIds[item.teacherKey]
    });
    courseIds[item.key] = course.id;
  }

  const questionIds = {};
  for (const item of data.questions) {
    const question = await repos.questions.create({
      courseId: courseIds[item.courseKey],
      type: item.type,
      stem: item.stem,
      options: item.options || null,
      answer: item.answer,
      score: item.score,
      difficulty: item.difficulty,
      knowledgePoint: item.knowledgePoint,
      analysis: item.analysis,
      creatorId: userIds.teacher01
    });
    questionIds[item.key] = question.id;
  }

  const examIds = {};
  for (const item of data.exams) {
    const exam = await repos.exams.createWithQuestions(
      {
        title: item.title,
        courseId: courseIds[item.courseKey],
        description: item.description,
        startTime: item.startTime,
        endTime: item.endTime,
        durationMin: item.durationMin,
        totalScore: item.questions.reduce((sum, question) => sum + question.score, 0),
        passScore: item.passScore,
        shuffle: item.shuffle,
        status: item.status,
        createdBy: userIds[item.createdByKey]
      },
      item.questions.map((question, index) => ({
        questionId: questionIds[question.questionKey],
        score: question.score,
        sortOrder: index + 1
      }))
    );
    examIds[item.key] = exam.id;
    if (item.studentKeys.length > 0) {
      await repos.exams.assignStudents(
        exam.id,
        item.studentKeys.map((key) => userIds[key])
      );
    }
  }

  for (const item of data.attempts) {
    const attempt = await repos.attempts.create({
      examId: examIds[item.examKey],
      studentId: userIds[item.studentKey],
      startedAt: item.startedAt,
      submittedAt: item.submittedAt,
      deadlineAt: item.deadlineAt,
      status: item.status,
      objectiveScore: item.objectiveScore,
      subjectiveScore: item.subjectiveScore,
      totalScore: item.totalScore
    });
    for (const answer of item.answers) {
      await repos.answers.upsert({
        attemptId: attempt.id,
        questionId: questionIds[answer.questionKey],
        answer: answer.answer,
        score: answer.score,
        comment: null,
        gradedBy: null,
        gradedAt: null
      });
    }
  }

  return {
    users: data.users.length,
    courses: data.courses.length,
    questions: data.questions.length,
    exams: data.exams.length,
    attempts: data.attempts.length
  };
}

/** 内存模式使用的种子入口 */
function seedMemory(repos, options = {}) {
  return seedRepositories(repos, options);
}

async function main() {
  const config = loadConfig();
  if (config.driver !== 'mysql') {
    console.error('[seed] db:seed 需要 MySQL：请在 .env 中设置 MYSQL_DRIVER=mysql');
    process.exitCode = 1;
    return;
  }
  // 延迟 require，避免内存模式加载 mysql2
  const { createMySqlRepositories } = require('../repositories/mysql');
  const repos = createMySqlRepositories(config.mysql);
  try {
    await repos.ping();
    const result = await seedRepositories(repos);
    console.log(
      `[seed] 完成：用户 ${result.users}、课程 ${result.courses}、题目 ${result.questions}、考试 ${result.exams}、答卷 ${result.attempts}`
    );
    console.log('[seed] 演示账号：admin/Admin@123、teacher01/Teach@123、student01/Stu@123');
  } finally {
    await repos.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[seed] 失败：', error.message);
    process.exitCode = 1;
  });
}

module.exports = { seedRepositories, seedMemory };
