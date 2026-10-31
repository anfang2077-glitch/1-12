'use strict';

const { ApiError } = require('../utils/response');
const { round2 } = require('../utils/answer');

const DISTRIBUTION = [
  { label: '[0,60)', min: 0, upper: 60 },
  { label: '[60,70)', min: 60, upper: 70 },
  { label: '[70,80)', min: 70, upper: 80 },
  { label: '[80,90)', min: 80, upper: 90 },
  { label: '[90,100]', min: 90, upper: Infinity }
];

function percent(part, total) {
  if (!total) return 0;
  return round2((part / total) * 100);
}

/**
 * 统计服务：全局概览、场次摘要、单场详情、学生历次成绩。
 * 口径：仅统计 submitted / graded 答卷。
 */
function createStatsService({ repos }) {
  async function requireExam(id) {
    const exam = await repos.exams.findById(id);
    if (!exam) throw ApiError.notFound('考试不存在');
    return exam;
  }

  function summarize(exam, attempts) {
    const count = attempts.length;
    const scores = attempts.map((attempt) => Number(attempt.totalScore));
    const sum = scores.reduce((total, score) => total + score, 0);
    const passed = attempts.filter(
      (attempt) => Number(attempt.totalScore) >= Number(exam.passScore)
    ).length;
    return {
      count,
      avg: count ? round2(sum / count) : 0,
      max: count ? round2(Math.max(...scores)) : 0,
      min: count ? round2(Math.min(...scores)) : 0,
      passRate: percent(passed, count)
    };
  }

  function distribution(exam, attempts) {
    const buckets = DISTRIBUTION.map((item) => ({ label: item.label, count: 0 }));
    const examTotal = Number(exam.totalScore);
    for (const attempt of attempts) {
      const ratio = examTotal > 0 ? Math.min(100, (Number(attempt.totalScore) / examTotal) * 100) : 0;
      let index = buckets.length - 1;
      for (let i = 0; i < DISTRIBUTION.length; i += 1) {
        if (ratio < DISTRIBUTION[i].upper) {
          index = i;
          break;
        }
      }
      buckets[index].count += 1;
    }
    return buckets;
  }

  return {
    async overview() {
      const [userCount, teacherCount, studentCount, courseCount, questionCount, examCount, attemptCount] =
        await Promise.all([
          repos.users.countAll(),
          repos.users.countByRole('teacher'),
          repos.users.countByRole('student'),
          repos.courses.listAll().then((rows) => rows.length),
          repos.questions.countAll(),
          repos.exams.countAll(),
          repos.attempts.countAll()
        ]);
      return {
        userCount,
        teacherCount,
        studentCount,
        courseCount,
        questionCount,
        examCount,
        attemptCount
      };
    },

    async exams(currentUser) {
      let exams;
      if (currentUser.role === 'teacher') {
        const courses = await repos.courses.listByTeacherId(currentUser.id);
        exams = await repos.exams.list({ courseIds: courses.map((course) => course.id) });
      } else {
        exams = await repos.exams.list({});
      }
      const result = [];
      for (const exam of exams) {
        const attempts = await repos.attempts.listByExamIds([exam.id], ['submitted', 'graded']);
        result.push({
          examId: exam.id,
          title: exam.title,
          courseId: exam.courseId,
          courseName: exam.courseName,
          status: exam.status,
          totalScore: Number(exam.totalScore),
          passScore: Number(exam.passScore),
          ...summarize(exam, attempts)
        });
      }
      return result;
    },

    async examDetail(currentUser, id) {
      const exam = await requireExam(id);
      if (currentUser.role !== 'admin') {
        const course = await repos.courses.findById(exam.courseId);
        if (!course || course.teacherId !== currentUser.id) {
          throw ApiError.forbidden('无权限操作该考试');
        }
      }
      const attempts = await repos.attempts.listByExamIds([exam.id], ['submitted', 'graded']);
      const questions = await repos.exams.getQuestions(exam.id);
      const aggregates = new Map(
        questions.map((question) => [
          question.questionId,
          { question, sum: 0, count: 0 }
        ])
      );

      for (const attempt of attempts) {
        const answers = await repos.answers.listByAttempt(attempt.id);
        const answerMap = new Map(answers.map((row) => [row.questionId, row]));
        for (const question of questions) {
          const aggregate = aggregates.get(question.questionId);
          const row = answerMap.get(question.questionId);
          aggregate.sum += Number((row && row.score) || 0);
          aggregate.count += 1;
        }
      }

      return {
        title: exam.title,
        ...summarize(exam, attempts),
        distribution: distribution(exam, attempts),
        questions: questions.map((question) => {
          const aggregate = aggregates.get(question.questionId);
          const avgScore = aggregate.count ? round2(aggregate.sum / aggregate.count) : 0;
          const fullScore = Number(question.score);
          return {
            questionId: question.questionId,
            stem: question.stem,
            type: question.type,
            accuracy: fullScore > 0 ? percent(avgScore, fullScore) : 0,
            avgScore
          };
        })
      };
    },

    async student(currentUser, studentId) {
      const student = await repos.users.findById(studentId);
      if (!student) throw ApiError.notFound('用户不存在');
      if (student.role !== 'student') throw ApiError.badRequest('参数错误：该用户不是学生');

      if (currentUser.role === 'student') {
        if (currentUser.id !== studentId) throw ApiError.forbidden('无权限访问该用户成绩');
      } else if (currentUser.role === 'teacher') {
        const related = await repos.exams.hasStudentRelation(currentUser.id, studentId);
        if (!related) throw ApiError.forbidden('无权限访问该用户成绩');
      } else {
        throw ApiError.forbidden('无权限访问该资源');
      }

      const attempts = (await repos.attempts.listByStudent(studentId))
        .filter((attempt) => attempt.status === 'submitted' || attempt.status === 'graded')
        .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));

      const list = [];
      let sum = 0;
      for (const attempt of attempts) {
        const exam = await requireExam(attempt.examId);
        sum += Number(attempt.totalScore);
        list.push({
          attemptId: attempt.id,
          examId: attempt.examId,
          examTitle: exam.title,
          fullScore: Number(exam.totalScore),
          passScore: Number(exam.passScore),
          totalScore: Number(attempt.totalScore),
          status: attempt.status,
          submittedAt: attempt.submittedAt
        });
      }
      return {
        studentId: student.id,
        studentName: student.realName,
        count: list.length,
        avg: list.length ? round2(sum / list.length) : 0,
        list
      };
    }
  };
}

module.exports = { createStatsService, DISTRIBUTION };
