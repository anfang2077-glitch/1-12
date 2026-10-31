'use strict';

const { ApiError } = require('../utils/response');
const { requireInt, requireNumber, badRequest } = require('../utils/validate');
const { round2 } = require('../utils/answer');
const { formatDateTime } = require('../utils/time');
const { countPending } = require('./attempt');

/**
 * 阅卷服务：待阅列表、阅卷详情、简答题评分与总分重算。
 */
function createGradingService({ repos, clock }) {
  async function requireAttempt(id) {
    const attempt = await repos.attempts.findById(id);
    if (!attempt) throw ApiError.notFound('答卷不存在');
    return attempt;
  }

  async function requireExam(id) {
    const exam = await repos.exams.findById(id);
    if (!exam) throw ApiError.notFound('考试不存在');
    return exam;
  }

  /** 教师只能阅本人课程答卷；管理员放行 */
  async function assertGradingAccess(currentUser, exam) {
    if (currentUser.role === 'admin') return;
    const course = await repos.courses.findById(exam.courseId);
    if (!course || course.teacherId !== currentUser.id) {
      throw ApiError.forbidden('无权限访问该答卷');
    }
  }

  return {
    async pending(currentUser, examId) {
      let examIds;
      if (examId !== undefined) {
        const exam = await requireExam(examId);
        if (currentUser.role !== 'admin') {
          const course = await repos.courses.findById(exam.courseId);
          if (!course || course.teacherId !== currentUser.id) {
            throw ApiError.forbidden('无权限操作该考试');
          }
        }
        examIds = [exam.id];
      } else if (currentUser.role === 'admin') {
        const exams = await repos.exams.list({});
        examIds = exams.map((exam) => exam.id);
      } else {
        const courses = await repos.courses.listByTeacherId(currentUser.id);
        const exams = await repos.exams.list({ courseIds: courses.map((course) => course.id) });
        examIds = exams.map((exam) => exam.id);
      }

      const attempts = await repos.attempts.listByExamIds(examIds, ['submitted', 'graded']);
      const result = [];
      for (const attempt of attempts) {
        const questions = await repos.exams.getQuestions(attempt.examId);
        const answers = await repos.answers.listByAttempt(attempt.id);
        const pendingCount = countPending(questions, answers);
        if (pendingCount === 0) continue;
        const student = await repos.users.findById(attempt.studentId);
        result.push({
          attemptId: attempt.id,
          studentName: student ? student.realName : null,
          submittedAt: attempt.submittedAt,
          pendingCount
        });
      }
      result.sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt)));
      return result;
    },

    async detail(currentUser, attemptId) {
      const attempt = await requireAttempt(attemptId);
      const exam = await requireExam(attempt.examId);
      await assertGradingAccess(currentUser, exam);
      if (attempt.status === 'in_progress') {
        throw ApiError.conflict('该答卷尚未交卷，无法阅卷');
      }

      const questions = await repos.exams.getQuestions(exam.id);
      const answers = await repos.answers.listByAttempt(attempt.id);
      const answerMap = new Map(answers.map((row) => [row.questionId, row]));
      const student = await repos.users.findById(attempt.studentId);
      const items = questions.map((question) => {
        const row = answerMap.get(question.questionId) || {};
        return {
          questionId: question.questionId,
          sortOrder: Number(question.sortOrder),
          type: question.type,
          stem: question.stem,
          options: question.options ?? null,
          correctAnswer: question.answer,
          studentAnswer: row.answer ?? null,
          fullScore: Number(question.score),
          score: Number(row.score || 0),
          comment: row.comment ?? null,
          gradedAt: row.gradedAt ?? null,
          needGrading: question.type === 'short' && !row.gradedAt
        };
      });

      return {
        attemptId: attempt.id,
        examId: attempt.examId,
        examTitle: exam.title,
        studentId: attempt.studentId,
        studentName: student ? student.realName : null,
        status: attempt.status,
        submittedAt: attempt.submittedAt,
        objectiveScore: Number(attempt.objectiveScore),
        subjectiveScore: Number(attempt.subjectiveScore),
        totalScore: Number(attempt.totalScore),
        pendingCount: items.filter((item) => item.needGrading).length,
        items
      };
    },

    async grade(currentUser, attemptId, items) {
      const attempt = await requireAttempt(attemptId);
      const exam = await requireExam(attempt.examId);
      await assertGradingAccess(currentUser, exam);
      if (attempt.status === 'in_progress') {
        throw ApiError.conflict('该答卷尚未交卷，无法阅卷');
      }
      if (!Array.isArray(items) || items.length === 0) {
        throw badRequest('参数错误：评分项不能为空');
      }
      if (items.length > 50) {
        throw badRequest('参数错误：单次最多提交 50 个评分项');
      }

      const questions = await repos.exams.getQuestions(exam.id);
      const questionMap = new Map(questions.map((question) => [question.questionId, question]));
      await repos.answers.ensureRows(attempt.id, questions.map((question) => question.questionId));

      const nowText = formatDateTime(clock());
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          throw badRequest(`参数错误：第 ${index + 1} 项评分格式不正确`);
        }
        const questionId = requireInt(item.questionId, '题目 ID', { min: 1 });
        const question = questionMap.get(questionId);
        if (!question) throw badRequest(`参数错误：题目 ${questionId} 不属于本场考试`);
        if (question.type !== 'short') throw badRequest('参数错误：只能对简答题评分');

        const fullScore = Number(question.score);
        const score = requireNumber(item.score, '分数', {
          min: 0,
          max: fullScore,
          decimals: 2,
          message: `参数错误：第 ${index + 1} 项分数必须在 0~${fullScore} 之间`
        });
        const comment = (() => {
          if (item.comment === undefined || item.comment === null) return null;
          if (typeof item.comment !== 'string') throw badRequest('参数错误：评语必须为文本');
          if (item.comment.length > 500) throw badRequest('参数错误：评语不能超过 500 字');
          return item.comment;
        })();

        await repos.answers.updateGrading(attempt.id, questionId, {
          score,
          comment,
          gradedBy: currentUser.id,
          gradedAt: nowText
        });
      }

      const answers = await repos.answers.listByAttempt(attempt.id);
      const answerMap = new Map(answers.map((row) => [row.questionId, row]));
      let objectiveScore = 0;
      let subjectiveScore = 0;
      for (const question of questions) {
        const row = answerMap.get(question.questionId);
        const score = Number((row && row.score) || 0);
        if (question.type === 'short') subjectiveScore += score;
        else objectiveScore += score;
      }
      const pendingCount = countPending(questions, answers);
      const updated = await repos.attempts.update(attempt.id, {
        status: 'graded',
        objectiveScore: round2(objectiveScore),
        subjectiveScore: round2(subjectiveScore),
        totalScore: round2(objectiveScore + subjectiveScore)
      });

      return {
        attemptId: updated.id,
        status: updated.status,
        objectiveScore: Number(updated.objectiveScore),
        subjectiveScore: Number(updated.subjectiveScore),
        totalScore: Number(updated.totalScore),
        pendingCount
      };
    }
  };
}

module.exports = { createGradingService };
