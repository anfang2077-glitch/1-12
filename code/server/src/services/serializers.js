'use strict';

/** 公共响应对象序列化：数据库行 / 内存对象 → 契约字段名 */

function toUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    realName: user.realName,
    role: user.role,
    email: user.email ?? null,
    status: Number(user.status),
    createdAt: user.createdAt
  };
}

/** 登录响应中的精简用户（基线 5.2：不含 status / createdAt） */
function toLoginUser(user) {
  return {
    id: user.id,
    username: user.username,
    realName: user.realName,
    role: user.role,
    email: user.email ?? null
  };
}

function toCourse(course) {
  if (!course) return null;
  return {
    id: course.id,
    name: course.name,
    code: course.code,
    description: course.description ?? null,
    teacherId: course.teacherId,
    teacherName: course.teacherName ?? null,
    createdAt: course.createdAt
  };
}

function toQuestion(question) {
  if (!question) return null;
  return {
    id: question.id,
    courseId: question.courseId,
    type: question.type,
    stem: question.stem,
    options: question.options ?? null,
    answer: question.answer,
    score: Number(question.score),
    difficulty: Number(question.difficulty),
    knowledgePoint: question.knowledgePoint ?? null,
    analysis: question.analysis ?? null,
    creatorId: question.creatorId ?? null,
    createdAt: question.createdAt
  };
}

function toExam(exam) {
  if (!exam) return null;
  return {
    id: exam.id,
    title: exam.title,
    courseId: exam.courseId,
    courseName: exam.courseName ?? null,
    description: exam.description ?? null,
    startTime: exam.startTime,
    endTime: exam.endTime,
    durationMin: Number(exam.durationMin),
    totalScore: Number(exam.totalScore),
    passScore: Number(exam.passScore),
    shuffle: Boolean(exam.shuffle),
    status: exam.status,
    createdBy: exam.createdBy,
    questionCount: Number(exam.questionCount || 0),
    createdAt: exam.createdAt
  };
}

/** 教师/管理员视角的试卷题目（含答案与解析） */
function toExamQuestionDetail(item) {
  return {
    questionId: item.questionId,
    sortOrder: Number(item.sortOrder),
    score: Number(item.score),
    type: item.type,
    stem: item.stem,
    options: item.options ?? null,
    answer: item.answer,
    analysis: item.analysis ?? null,
    difficulty: Number(item.difficulty),
    knowledgePoint: item.knowledgePoint ?? null
  };
}

/** 学生答题视角的题目（无 answer / analysis） */
function toPaperQuestion(item) {
  return {
    questionId: item.questionId,
    sortOrder: Number(item.sortOrder),
    score: Number(item.score),
    type: item.type,
    stem: item.stem,
    options: item.options ?? null
  };
}

module.exports = {
  toUser,
  toLoginUser,
  toCourse,
  toQuestion,
  toExam,
  toExamQuestionDetail,
  toPaperQuestion
};
