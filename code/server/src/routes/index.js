'use strict';

const express = require('express');
const { createAuthenticate, authorize } = require('../middlewares/auth');

const { createAuthService } = require('../services/auth');
const { createUserService } = require('../services/user');
const { createCourseService } = require('../services/course');
const { createQuestionService } = require('../services/question');
const { createExamService } = require('../services/exam');
const { createAttemptService } = require('../services/attempt');
const { createGradingService } = require('../services/grading');
const { createStatsService } = require('../services/stats');

const { createAuthController } = require('../controllers/auth');
const { createUserController } = require('../controllers/users');
const { createCourseController } = require('../controllers/courses');
const { createQuestionController } = require('../controllers/questions');
const { createExamController } = require('../controllers/exams');
const { createAttemptController } = require('../controllers/attempts');
const { createGradingController } = require('../controllers/grading');
const { createStatsController } = require('../controllers/stats');

/**
 * 装配 /api 路由与中间件。返回的 Router 供 createApp 挂载。
 * 注意路由顺序：/exams/available 先于 /exams/:id；/grading/pending 先于 /grading/:attemptId。
 */
function createApiRouter(deps) {
  const services = {
    auth: createAuthService(deps),
    user: createUserService(deps),
    course: createCourseService(deps),
    question: createQuestionService(deps),
    exam: createExamService(deps),
    attempt: createAttemptService(deps),
    grading: createGradingService(deps),
    stats: createStatsService(deps)
  };
  const controllers = {
    auth: createAuthController({ authService: services.auth }),
    users: createUserController({ userService: services.user }),
    courses: createCourseController({ courseService: services.course }),
    questions: createQuestionController({ questionService: services.question }),
    exams: createExamController({ examService: services.exam }),
    attempts: createAttemptController({ attemptService: services.attempt }),
    grading: createGradingController({ gradingService: services.grading }),
    stats: createStatsController({ statsService: services.stats })
  };

  const router = express.Router();
  const auth = createAuthenticate(deps);
  const allow = (...roles) => authorize(...roles);

  // 5.2 认证
  router.post('/auth/login', controllers.auth.login);
  router.get('/auth/me', auth, controllers.auth.me);

  // 5.3 用户管理（admin）
  router.get('/users', auth, allow('admin'), controllers.users.list);
  router.post('/users', auth, allow('admin'), controllers.users.create);
  router.put('/users/:id', auth, allow('admin'), controllers.users.update);
  router.delete('/users/:id', auth, allow('admin'), controllers.users.remove);

  // 5.4 课程
  router.get('/courses', auth, controllers.courses.list);
  router.post('/courses', auth, allow('admin', 'teacher'), controllers.courses.create);
  router.put('/courses/:id', auth, allow('admin', 'teacher'), controllers.courses.update);
  router.delete('/courses/:id', auth, allow('admin'), controllers.courses.remove);

  // 5.5 题库
  router.get('/questions', auth, allow('teacher', 'admin'), controllers.questions.list);
  router.post('/questions/import', auth, allow('teacher', 'admin'), controllers.questions.importQuestions);
  router.post('/questions', auth, allow('teacher', 'admin'), controllers.questions.create);
  router.put('/questions/:id', auth, allow('teacher', 'admin'), controllers.questions.update);
  router.delete('/questions/:id', auth, allow('teacher', 'admin'), controllers.questions.remove);

  // 5.6 考试（available / paper 必须在 /exams/:id 之前）
  router.get('/exams/available', auth, allow('student'), controllers.exams.available);
  router.get('/exams/:id/paper', auth, allow('student'), controllers.exams.paper);
  router.post('/exams/:id/attempts', auth, allow('student'), controllers.exams.start);
  router.get('/exams', auth, allow('teacher', 'admin'), controllers.exams.list);
  router.post('/exams', auth, allow('teacher', 'admin'), controllers.exams.create);
  router.get('/exams/:id', auth, allow('teacher', 'admin'), controllers.exams.detail);
  router.put('/exams/:id', auth, allow('teacher', 'admin'), controllers.exams.update);
  router.delete('/exams/:id', auth, allow('teacher', 'admin'), controllers.exams.remove);
  router.post('/exams/:id/publish', auth, allow('teacher', 'admin'), controllers.exams.publish);
  router.post('/exams/:id/assign', auth, allow('teacher', 'admin'), controllers.exams.assign);

  // 5.7 答题与交卷
  router.get('/attempts/:id', auth, allow('student', 'teacher'), controllers.attempts.get);
  router.put('/attempts/:id/answers', auth, allow('student'), controllers.attempts.saveAnswer);
  router.post('/attempts/:id/submit', auth, allow('student'), controllers.attempts.submit);
  router.get('/attempts/:id/result', auth, allow('student', 'teacher', 'admin'), controllers.attempts.result);

  // 5.8 阅卷（pending 必须在 /grading/:attemptId 之前）
  router.get('/grading/pending', auth, allow('teacher', 'admin'), controllers.grading.pending);
  router.get('/grading/:attemptId', auth, allow('teacher', 'admin'), controllers.grading.detail);
  router.post('/grading/:attemptId', auth, allow('teacher', 'admin'), controllers.grading.grade);

  // 5.9 统计
  router.get('/stats/overview', auth, allow('admin'), controllers.stats.overview);
  router.get('/stats/exams', auth, allow('teacher', 'admin'), controllers.stats.exams);
  router.get('/stats/exams/:id', auth, allow('teacher', 'admin'), controllers.stats.examDetail);
  router.get('/stats/students/:id', auth, allow('student', 'teacher'), controllers.stats.student);

  return router;
}

module.exports = createApiRouter;
