'use strict';

const { ApiError } = require('../utils/response');
const { requireInt, optionalInt, optionalEnum, optionalString } = require('../utils/validate');
const { QUESTION_TYPES, normalizeQuestionInput } = require('../utils/answer');
const { toQuestion } = require('./serializers');

const MUTABLE_FIELDS = [
  'type',
  'stem',
  'options',
  'answer',
  'score',
  'difficulty',
  'knowledgePoint',
  'analysis'
];

function has(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

/**
 * 题库服务：教师只能操作本人课程下的题目。
 */
function createQuestionService({ repos }) {
  async function requireQuestion(id) {
    const question = await repos.questions.findById(id);
    if (!question) throw ApiError.notFound('题目不存在');
    return question;
  }

  async function requireCourse(courseId) {
    const course = await repos.courses.findById(courseId);
    if (!course) throw ApiError.notFound('课程不存在');
    return course;
  }

  async function assertCourseAccess(currentUser, courseId) {
    const course = await requireCourse(courseId);
    if (currentUser.role === 'teacher' && course.teacherId !== currentUser.id) {
      throw ApiError.forbidden('无权限操作该课程');
    }
    return course;
  }

  return {
    async list(currentUser, query) {
      const page = query.page;
      const pageSize = query.pageSize;
      const courseId = optionalInt(query.courseId, 'courseId', { min: 1 });
      const type = optionalEnum(
        query.type,
        QUESTION_TYPES,
        '题型',
        '参数错误：题型取值必须为 single/multiple/judge/short'
      );
      const difficulty = optionalInt(query.difficulty, '难度', { min: 1, max: 5 });
      const keyword = optionalString(query.keyword, 'keyword', { max: 100 });

      let courseIds;
      if (currentUser.role === 'teacher') {
        const courses = await repos.courses.listByTeacherId(currentUser.id);
        courseIds = courses.map((course) => course.id);
        if (courseId !== undefined) {
          if (!courseIds.includes(courseId)) {
            await requireCourse(courseId);
            throw ApiError.forbidden('无权限操作该课程');
          }
          courseIds = [courseId];
        }
        if (courseIds.length === 0) return { list: [], total: 0, page, pageSize };
      } else if (courseId !== undefined) {
        await requireCourse(courseId);
        courseIds = [courseId];
      }

      const result = await repos.questions.list({
        courseIds,
        courseId,
        type,
        difficulty,
        keyword,
        page,
        pageSize
      });
      return { list: result.list.map(toQuestion), total: result.total, page, pageSize };
    },

    async create(currentUser, body) {
      const courseId = requireInt(body.courseId, '课程 ID', { min: 1 });
      await assertCourseAccess(currentUser, courseId);
      const data = normalizeQuestionInput(body);
      const question = await repos.questions.create({
        courseId,
        ...data,
        creatorId: currentUser.id
      });
      return toQuestion(question);
    },

    async update(currentUser, id, body) {
      const question = await requireQuestion(id);
      await assertCourseAccess(currentUser, question.courseId);

      const provided = MUTABLE_FIELDS.filter((field) => has(body, field));
      if (provided.length === 0) {
        throw ApiError.badRequest('参数错误：没有需要更新的字段');
      }

      const usage = await repos.exams.isQuestionUsed(id);
      if (usage.active) {
        const typeChanged = has(body, 'type') && body.type !== question.type;
        const answerChanged =
          has(body, 'answer') && JSON.stringify(body.answer) !== JSON.stringify(question.answer);
        if (typeChanged || answerChanged) {
          throw ApiError.conflict('该题目已被已发布试卷引用，不能修改题型或答案');
        }
      }

      const merged = {};
      for (const field of MUTABLE_FIELDS) {
        merged[field] = has(body, field) ? body[field] : question[field];
      }
      const normalized = normalizeQuestionInput(merged);
      const changes = {};
      for (const field of provided) changes[field] = normalized[field];
      if (has(body, 'type')) changes.options = normalized.options;

      const updated = await repos.questions.update(id, changes);
      return toQuestion(updated);
    },

    async remove(currentUser, id) {
      const question = await requireQuestion(id);
      await assertCourseAccess(currentUser, question.courseId);
      const usage = await repos.exams.isQuestionUsed(id);
      if (usage.any) throw ApiError.conflict('该题目已被试卷引用，无法删除');
      await repos.questions.remove(id);
      return { id };
    },

    async importQuestions(currentUser, courseId, questions) {
      await assertCourseAccess(currentUser, courseId);
      let imported = 0;
      const failed = [];
      for (let index = 0; index < questions.length; index += 1) {
        try {
          const data = normalizeQuestionInput(questions[index]);
          await repos.questions.create({
            courseId,
            ...data,
            creatorId: currentUser.id
          });
          imported += 1;
        } catch (error) {
          if (!(error instanceof ApiError)) throw error;
          failed.push({ index, reason: error.message.replace(/^参数错误：/, '') });
        }
      }
      return { imported, failed };
    }
  };
}

module.exports = { createQuestionService };
