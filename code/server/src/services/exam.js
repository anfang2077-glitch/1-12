'use strict';

const { ApiError } = require('../utils/response');
const {
  requireString,
  optionalString,
  requireInt,
  optionalInt,
  requireNumber,
  optionalBoolean,
  optionalEnum,
  requireDateTime,
  badRequest
} = require('../utils/validate');
const {
  addMinutes,
  formatDateTime,
  isAfter,
  minDateTime,
  remainingSeconds
} = require('../utils/time');
const { round2 } = require('../utils/answer');
const { finalizeAttempt } = require('./attempt');
const { toExam, toExamQuestionDetail, toPaperQuestion } = require('./serializers');

const EXAM_STATUS = ['draft', 'published', 'closed'];

function has(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

/**
 * 考试服务：组卷、发布、指派、学生试卷与开考。
 */
function createExamService({ repos, clock }) {
  async function requireExam(id) {
    const exam = await repos.exams.findById(id);
    if (!exam) throw ApiError.notFound('考试不存在');
    return exam;
  }

  async function requireCourse(courseId) {
    const course = await repos.courses.findById(courseId);
    if (!course) throw ApiError.notFound('课程不存在');
    return course;
  }

  /** 教师只能操作本人课程下的考试；管理员放行 */
  async function assertExamAccess(currentUser, exam) {
    if (currentUser.role === 'admin') return;
    const course = await repos.courses.findById(exam.courseId);
    if (!course || course.teacherId !== currentUser.id) {
      throw ApiError.forbidden('无权限操作该考试');
    }
  }

  /** 校验组卷题目：1~200 道、同卷不重复、属于本课程、分值 > 0 */
  async function resolveExamQuestions(courseId, rawList) {
    if (!Array.isArray(rawList) || rawList.length === 0) {
      throw badRequest('参数错误：试卷至少包含 1 道题');
    }
    if (rawList.length > 200) {
      throw badRequest('参数错误：试卷最多包含 200 道题');
    }
    const seen = new Set();
    const resolved = [];
    for (let index = 0; index < rawList.length; index += 1) {
      const item = rawList[index];
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw badRequest(`参数错误：第 ${index + 1} 题的格式不正确`);
      }
      const questionId = requireInt(item.questionId, '题目 ID', { min: 1 });
      if (seen.has(questionId)) {
        throw badRequest('参数错误：同一题目不能重复加入试卷');
      }
      seen.add(questionId);
      const score = requireNumber(item.score, '题目分值', {
        min: 0.01,
        max: 9999.99,
        decimals: 2,
        message: '参数错误：每题分值必须大于 0 且最多两位小数'
      });
      const question = await repos.questions.findById(questionId);
      if (!question || question.courseId !== courseId) {
        throw badRequest(`参数错误：第 ${index + 1} 题的题目不属于本课程`);
      }
      resolved.push({ questionId, score, sortOrder: index + 1 });
    }
    return resolved;
  }

  const totalOf = (questions) => round2(questions.reduce((sum, item) => sum + item.score, 0));

  return {
    async list(currentUser, query) {
      const status = optionalEnum(
        query.status,
        EXAM_STATUS,
        'status',
        '参数错误：status 取值必须为 draft/published/closed'
      );
      const courseId = optionalInt(query.courseId, 'courseId', { min: 1 });

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
        if (courseIds.length === 0) return [];
      } else if (courseId !== undefined) {
        await requireCourse(courseId);
        courseIds = [courseId];
      }

      const list = await repos.exams.list({ status, courseIds });
      return list.map(toExam);
    },

    async create(currentUser, body) {
      const title = requireString(body.title, '考试标题', { max: 150 });
      const courseId = requireInt(body.courseId, '课程 ID', { min: 1 });
      const description = optionalString(body.description, '考试说明', { max: 500 }) ?? null;
      const start = requireDateTime(body.startTime, '开始时间');
      const end = requireDateTime(body.endTime, '结束时间');
      if (end.getTime() <= start.getTime()) {
        throw badRequest('参数错误：结束时间必须晚于开始时间');
      }
      const durationMin = requireInt(body.durationMin, '考试时长', { min: 1, max: 600 });
      const passScore = requireNumber(body.passScore, '及格线', {
        min: 0,
        max: 9999.99,
        decimals: 2
      });
      const shuffle = optionalBoolean(body.shuffle, 'shuffle') ?? false;

      const course = await requireCourse(courseId);
      if (currentUser.role === 'teacher' && course.teacherId !== currentUser.id) {
        throw ApiError.forbidden('无权限操作该课程');
      }

      const questions = await resolveExamQuestions(courseId, body.questions);
      const exam = await repos.exams.createWithQuestions(
        {
          title,
          courseId,
          description,
          startTime: formatDateTime(start),
          endTime: formatDateTime(end),
          durationMin,
          totalScore: totalOf(questions),
          passScore,
          shuffle,
          status: 'draft',
          createdBy: currentUser.id
        },
        questions
      );
      return toExam(exam);
    },

    async detail(currentUser, id) {
      const exam = await requireExam(id);
      await assertExamAccess(currentUser, exam);
      const questions = await repos.exams.getQuestions(exam.id);
      return {
        ...toExam(exam),
        assignedCount: Number(exam.assignedCount || 0),
        questions: questions.map(toExamQuestionDetail)
      };
    },

    async update(currentUser, id, body) {
      const exam = await requireExam(id);
      await assertExamAccess(currentUser, exam);
      if (exam.status !== 'draft') throw ApiError.conflict('仅草稿状态的考试可以修改');
      if ((await repos.attempts.countByExam(exam.id)) > 0) {
        throw ApiError.conflict('该考试已有答卷，不能修改试卷内容');
      }

      const patch = {};
      if (has(body, 'title')) patch.title = requireString(body.title, '考试标题', { max: 150 });
      if (has(body, 'description')) {
        patch.description = optionalString(body.description, '考试说明', { max: 500 }) ?? null;
      }
      if (has(body, 'durationMin')) {
        patch.durationMin = requireInt(body.durationMin, '考试时长', { min: 1, max: 600 });
      }
      if (has(body, 'passScore')) {
        patch.passScore = requireNumber(body.passScore, '及格线', {
          min: 0,
          max: 9999.99,
          decimals: 2
        });
      }
      if (has(body, 'shuffle')) {
        patch.shuffle = optionalBoolean(body.shuffle, 'shuffle');
      }

      const start = has(body, 'startTime')
        ? requireDateTime(body.startTime, '开始时间')
        : requireDateTime(exam.startTime, '开始时间');
      const end = has(body, 'endTime')
        ? requireDateTime(body.endTime, '结束时间')
        : requireDateTime(exam.endTime, '结束时间');
      if (end.getTime() <= start.getTime()) {
        throw badRequest('参数错误：结束时间必须晚于开始时间');
      }
      if (has(body, 'startTime')) patch.startTime = formatDateTime(start);
      if (has(body, 'endTime')) patch.endTime = formatDateTime(end);

      let questions = null;
      if (has(body, 'questions')) {
        questions = await resolveExamQuestions(exam.courseId, body.questions);
        patch.totalScore = totalOf(questions);
      }

      if (Object.keys(patch).length === 0) {
        throw badRequest('参数错误：没有需要更新的字段');
      }

      if (questions) {
        const updated = await repos.exams.replaceQuestions(id, questions, patch.totalScore);
        delete patch.totalScore;
        if (Object.keys(patch).length > 0) await repos.exams.update(id, patch);
        return toExam(await repos.exams.findById(updated.id));
      }
      await repos.exams.update(id, patch);
      return toExam(await repos.exams.findById(id));
    },

    async remove(currentUser, id) {
      const exam = await requireExam(id);
      await assertExamAccess(currentUser, exam);
      if (exam.status !== 'draft') throw ApiError.conflict('仅草稿状态的考试可以删除');
      if ((await repos.attempts.countByExam(exam.id)) > 0) {
        throw ApiError.conflict('该考试已有答卷，不能删除');
      }
      await repos.exams.remove(id);
      return { id };
    },

    async publish(currentUser, id) {
      const exam = await requireExam(id);
      await assertExamAccess(currentUser, exam);
      if (exam.status !== 'draft') throw ApiError.conflict('仅草稿状态的考试可以发布');

      const questionCount = await repos.exams.countQuestions(exam.id);
      if (questionCount === 0) throw badRequest('发布失败：试卷至少需要 1 道题');
      if (Number(exam.totalScore) <= 0) throw badRequest('发布失败：试卷总分必须大于 0');
      if (Number(exam.passScore) > Number(exam.totalScore)) {
        throw badRequest('发布失败：及格线不能大于试卷总分');
      }
      const start = requireDateTime(exam.startTime, '开始时间');
      const end = requireDateTime(exam.endTime, '结束时间');
      if (end.getTime() <= start.getTime()) {
        throw badRequest('发布失败：考试开始时间必须早于结束时间');
      }

      await repos.exams.setStatus(exam.id, 'published');
      return {
        id: exam.id,
        title: exam.title,
        status: 'published',
        totalScore: Number(exam.totalScore),
        passScore: Number(exam.passScore),
        questionCount,
        assignedCount: await repos.exams.countAssigned(exam.id)
      };
    },

    async assign(currentUser, id, studentIds) {
      const exam = await requireExam(id);
      await assertExamAccess(currentUser, exam);
      if (!Array.isArray(studentIds)) {
        throw badRequest('参数错误：studentIds 必须为数组');
      }
      if (studentIds.length > 500) {
        throw badRequest('参数错误：单次最多指派 500 名学生');
      }
      const unique = [...new Set(studentIds.map((item, index) => requireInt(item, `第 ${index + 1} 个学生 ID`, { min: 1 })))];
      for (const studentId of unique) {
        const student = await repos.users.findById(studentId);
        if (!student) throw badRequest(`参数错误：学生 ${studentId} 不存在`);
        if (student.role !== 'student') throw badRequest(`参数错误：用户 ${studentId} 不是学生`);
      }
      await repos.exams.assignStudents(exam.id, unique);
      return { examId: exam.id, assignedCount: unique.length, studentIds: unique };
    },

    async available(currentUser) {
      const exams = await repos.exams.listForStudent(currentUser.id);
      const result = [];
      for (const exam of exams) {
        const attempt = await repos.attempts.findByExamAndStudent(exam.id, currentUser.id);
        const inProgress = attempt && attempt.status === 'in_progress';
        result.push({
          id: exam.id,
          title: exam.title,
          courseId: exam.courseId,
          courseName: exam.courseName,
          startTime: exam.startTime,
          endTime: exam.endTime,
          durationMin: Number(exam.durationMin),
          totalScore: Number(exam.totalScore),
          passScore: Number(exam.passScore),
          status: exam.status,
          attemptStatus: attempt ? attempt.status : 'none',
          attemptId: attempt ? attempt.id : null,
          remainingSeconds: inProgress ? remainingSeconds(attempt.deadlineAt, clock()) : 0,
          totalScoreObtained:
            attempt && attempt.status !== 'in_progress' ? Number(attempt.totalScore) : null
        });
      }
      return result;
    },

    async paper(currentUser, id) {
      const exam = await requireExam(id);
      if (exam.status !== 'published') throw ApiError.conflict('考试尚未发布');
      if (!(await repos.exams.isAssigned(exam.id, currentUser.id))) {
        throw ApiError.forbidden('您未被指派该考试');
      }

      const questions = await repos.exams.getQuestions(exam.id);
      const attempt = await repos.attempts.findByExamAndStudent(exam.id, currentUser.id);
      return {
        exam: {
          id: exam.id,
          title: exam.title,
          courseId: exam.courseId,
          courseName: exam.courseName,
          startTime: exam.startTime,
          endTime: exam.endTime,
          durationMin: Number(exam.durationMin),
          totalScore: Number(exam.totalScore),
          passScore: Number(exam.passScore),
          shuffle: Boolean(exam.shuffle),
          status: exam.status
        },
        questions: questions.map(toPaperQuestion),
        attempt: attempt
          ? {
              attemptId: attempt.id,
              status: attempt.status,
              deadlineAt: attempt.deadlineAt,
              remainingSeconds:
                attempt.status === 'in_progress'
                  ? remainingSeconds(attempt.deadlineAt, clock())
                  : 0
            }
          : null
      };
    },

    async start(currentUser, id) {
      const exam = await requireExam(id);
      if (exam.status !== 'published') throw ApiError.conflict('考试尚未发布');
      if (!(await repos.exams.isAssigned(exam.id, currentUser.id))) {
        throw ApiError.forbidden('您未被指派该考试');
      }

      const now = clock();
      const startTime = requireDateTime(exam.startTime, '开始时间');
      const endTime = requireDateTime(exam.endTime, '结束时间');
      if (isAfter(startTime, now)) throw ApiError.conflict('考试尚未开始');
      if (isAfter(now, endTime)) throw ApiError.conflict('考试已结束');

      const existing = await repos.attempts.findByExamAndStudent(exam.id, currentUser.id);
      if (existing) {
        if (existing.status !== 'in_progress') {
          throw ApiError.conflict('您已提交该考试，不能重复开考');
        }
        const attempt = isAfter(now, existing.deadlineAt)
          ? await finalizeAttempt({ repos, attempt: existing, exam, clock, submittedAt: existing.deadlineAt })
          : existing;
        return {
          created: false,
          attemptId: attempt.id,
          deadlineAt: attempt.deadlineAt,
          remainingSeconds:
            attempt.status === 'in_progress' ? remainingSeconds(attempt.deadlineAt, now) : 0
        };
      }

      const deadlineAt = minDateTime(addMinutes(now, exam.durationMin), exam.endTime);
      try {
        const attempt = await repos.attempts.create({
          examId: exam.id,
          studentId: currentUser.id,
          startedAt: formatDateTime(now),
          deadlineAt,
          status: 'in_progress'
        });
        return {
          created: true,
          attemptId: attempt.id,
          deadlineAt: attempt.deadlineAt,
          remainingSeconds: remainingSeconds(attempt.deadlineAt, now)
        };
      } catch (error) {
        // 并发开考触发唯一索引冲突：返回已有答卷
        if (error && error.code === 'ER_DUP_ENTRY') {
          const attempt = await repos.attempts.findByExamAndStudent(exam.id, currentUser.id);
          return {
            created: false,
            attemptId: attempt.id,
            deadlineAt: attempt.deadlineAt,
            remainingSeconds: remainingSeconds(attempt.deadlineAt, now)
          };
        }
        throw error;
      }
    }
  };
}

module.exports = { createExamService, EXAM_STATUS };
