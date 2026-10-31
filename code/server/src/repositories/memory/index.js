'use strict';

const { createStore } = require('./store');
const { createUsersRepository } = require('./users');
const { createCoursesRepository } = require('./courses');
const { createQuestionsRepository } = require('./questions');
const { createExamsRepository } = require('./exams');
const { createAttemptsRepository } = require('./attempts');
const { createAnswersRepository } = require('./answers');

/**
 * 创建一整套内存仓储（同一 store 共享数据，模拟数据库）。
 * 每次调用返回独立数据集，测试之间互不影响。
 */
function createMemoryRepositories() {
  const store = createStore();
  return {
    store,
    users: createUsersRepository(store),
    courses: createCoursesRepository(store),
    questions: createQuestionsRepository(store),
    exams: createExamsRepository(store),
    attempts: createAttemptsRepository(store),
    answers: createAnswersRepository(store),
    async ping() {
      return true;
    },
    async close() {
      return true;
    }
  };
}

module.exports = { createMemoryRepositories };
