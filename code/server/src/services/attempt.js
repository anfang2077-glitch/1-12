'use strict';

const { ApiError } = require('../utils/response');
const { formatDateTime, isAfter, remainingSeconds } = require('../utils/time');
const { isAnswerCorrect, validateStudentAnswer, round2 } = require('../utils/answer');
const { toPaperQuestion } = require('./serializers');

/**
 * 判分并落库：客观题自动判分、简答题进入待阅。
 * 幂等：仅 in_progress 状态执行；重复调用返回当前答卷。
 * @param {{repos:object, attempt:object, exam:object, clock:Function, submittedAt?:string}} params
 *   submittedAt：交卷时间。超时自动交卷须传 deadline_at，保证成绩归属与考试窗口一致。
 */
async function finalizeAttempt({ repos, attempt, exam, clock, submittedAt }) {
  if (attempt.status !== 'in_progress') return attempt;

  const questions = await repos.exams.getQuestions(exam.id);
  await repos.answers.ensureRows(
    attempt.id,
    questions.map((question) => question.questionId)
  );
  const answers = await repos.answers.listByAttempt(attempt.id);
  const answerMap = new Map(answers.map((row) => [row.questionId, row]));

  let objectiveScore = 0;
  for (const question of questions) {
    if (question.type === 'short') continue;
    const row = answerMap.get(question.questionId);
    const studentAnswer = row ? row.answer : null;
    const score = isAnswerCorrect(question.type, question.answer, studentAnswer)
      ? round2(question.score)
      : 0;
    await repos.answers.updateScore(attempt.id, question.questionId, score);
    objectiveScore += score;
  }

  const hasShort = questions.some((question) => question.type === 'short');
  return repos.attempts.update(attempt.id, {
    status: hasShort ? 'submitted' : 'graded',
    submittedAt: formatDateTime(submittedAt || clock()),
    objectiveScore: round2(objectiveScore),
    subjectiveScore: 0,
    totalScore: round2(objectiveScore)
  });
}

/** 若 in_progress 且已超过 deadline，则自动交卷 */
async function autoSubmitIfExpired({ repos, attempt, exam, clock }) {
  if (attempt.status !== 'in_progress') return attempt;
  if (!isAfter(clock(), attempt.deadlineAt)) return attempt;
  // 超时交卷：交卷时间取 deadline_at，而非实际触发时刻
  return finalizeAttempt({ repos, attempt, exam, clock, submittedAt: attempt.deadlineAt });
}

/** 统计待阅简答题数量（graded_at 为空的简答题） */
function countPending(questions, answers) {
  const shortIds = new Set(
    questions.filter((question) => question.type === 'short').map((question) => question.questionId)
  );
  return answers.filter((answer) => shortIds.has(answer.questionId) && !answer.gradedAt).length;
}

/**
 * 答卷服务：断线恢复、单题自动保存、交卷、成绩查询。
 */
function createAttemptService({ repos, clock }) {
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

  /** 校验答卷读取权限（学生本人 / 教师本人课程 / 管理员按需） */
  async function assertReadable(currentUser, attempt, exam, allowAdmin = false) {
    if (currentUser.role === 'admin') {
      if (allowAdmin) return;
      throw ApiError.forbidden('无权限访问该资源');
    }
    if (currentUser.role === 'student') {
      if (attempt.studentId !== currentUser.id) throw ApiError.forbidden('无权限访问该答卷');
      return;
    }
    const course = await repos.courses.findById(exam.courseId);
    if (!course || course.teacherId !== currentUser.id) {
      throw ApiError.forbidden('无权限访问该答卷');
    }
  }

  return {
    async get(currentUser, id) {
      let attempt = await requireAttempt(id);
      const exam = await requireExam(attempt.examId);
      await assertReadable(currentUser, attempt, exam, false);
      attempt = await autoSubmitIfExpired({ repos, attempt, exam, clock });

      const questions = await repos.exams.getQuestions(exam.id);
      const answers = await repos.answers.listByAttempt(attempt.id);
      const answerMap = new Map(answers.map((row) => [row.questionId, row]));

      return {
        attemptId: attempt.id,
        examId: attempt.examId,
        examTitle: exam.title,
        status: attempt.status,
        startedAt: attempt.startedAt,
        deadlineAt: attempt.deadlineAt,
        remainingSeconds:
          attempt.status === 'in_progress' ? remainingSeconds(attempt.deadlineAt, clock()) : 0,
        totalScore: attempt.status === 'in_progress' ? null : Number(attempt.totalScore),
        questions: questions.map((question) => ({
          ...toPaperQuestion(question),
          savedAnswer: (answerMap.get(question.questionId) || {}).answer ?? null
        }))
      };
    },

    async saveAnswer(currentUser, id, questionId, answer) {
      const attempt = await requireAttempt(id);
      if (attempt.studentId !== currentUser.id) {
        throw ApiError.forbidden('无权限操作该答卷');
      }
      const exam = await requireExam(attempt.examId);
      const now = clock();

      if (attempt.status !== 'in_progress') {
        throw ApiError.conflict('答卷已提交，不能继续作答');
      }
      if (isAfter(now, attempt.deadlineAt)) {
        await finalizeAttempt({ repos, attempt, exam, clock, submittedAt: attempt.deadlineAt });
        throw ApiError.conflict('考试已结束，答卷已自动提交');
      }

      const questions = await repos.exams.getQuestions(exam.id);
      const question = questions.find((item) => item.questionId === questionId);
      if (!question) throw ApiError.badRequest('参数错误：该题目不属于本场考试');

      const normalized = validateStudentAnswer(question.type, answer, question.options);
      await repos.answers.upsert({
        attemptId: attempt.id,
        questionId,
        answer: normalized
      });
      return { questionId, savedAt: formatDateTime(now) };
    },

    async submit(currentUser, id) {
      let attempt = await requireAttempt(id);
      if (attempt.studentId !== currentUser.id) {
        throw ApiError.forbidden('无权限操作该答卷');
      }
      const exam = await requireExam(attempt.examId);
      if (attempt.status === 'in_progress') {
        const now = clock();
        // 已过截止时间时按超时口径记账，交卷时间取 deadline_at
        const expired = isAfter(now, attempt.deadlineAt);
        attempt = await finalizeAttempt({
          repos,
          attempt,
          exam,
          clock,
          submittedAt: expired ? attempt.deadlineAt : now
        });
      }

      const questions = await repos.exams.getQuestions(exam.id);
      const answers = await repos.answers.listByAttempt(attempt.id);
      return {
        totalScore: round2(attempt.totalScore),
        objectiveScore: round2(attempt.objectiveScore),
        subjectivePending: countPending(questions, answers)
      };
    },

    async result(currentUser, id) {
      let attempt = await requireAttempt(id);
      const exam = await requireExam(attempt.examId);
      await assertReadable(currentUser, attempt, exam, true);
      attempt = await autoSubmitIfExpired({ repos, attempt, exam, clock });
      if (attempt.status === 'in_progress') {
        throw ApiError.conflict('该答卷尚未提交，暂无成绩');
      }

      const questions = await repos.exams.getQuestions(exam.id);
      const answers = await repos.answers.listByAttempt(attempt.id);
      const answerMap = new Map(answers.map((row) => [row.questionId, row]));

      return {
        attemptId: attempt.id,
        examId: attempt.examId,
        examTitle: exam.title,
        status: attempt.status,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        objectiveScore: Number(attempt.objectiveScore),
        subjectiveScore: Number(attempt.subjectiveScore),
        totalScore: Number(attempt.totalScore),
        examTotalScore: Number(exam.totalScore),
        passScore: Number(exam.passScore),
        passed: Number(attempt.totalScore) >= Number(exam.passScore),
        items: questions.map((question) => {
          const row = answerMap.get(question.questionId) || {};
          return {
            questionId: question.questionId,
            sortOrder: Number(question.sortOrder),
            type: question.type,
            stem: question.stem,
            options: question.options ?? null,
            myAnswer: row.answer ?? null,
            correctAnswer: question.answer,
            score: Number(row.score || 0),
            fullScore: Number(question.score),
            comment: row.comment ?? null,
            analysis: question.analysis ?? null
          };
        })
      };
    }
  };
}

module.exports = {
  createAttemptService,
  finalizeAttempt,
  autoSubmitIfExpired,
  countPending
};
