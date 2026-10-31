'use strict';

const { createPool, createDb } = require('../../db/mysql');
const { createUsersRepository } = require('./users');
const { createCoursesRepository } = require('./courses');
const { createQuestionsRepository } = require('./questions');
const { createExamsRepository } = require('./exams');
const { createAttemptsRepository } = require('./attempts');
const { createAnswersRepository } = require('./answers');

/**
 * 创建 MySQL 仓储集合。
 * @param {object} mysqlConfig 见 config.mysql
 */
function createMySqlRepositories(mysqlConfig) {
  const pool = createPool(mysqlConfig);
  const db = createDb(pool);
  return {
    pool,
    users: createUsersRepository(db),
    courses: createCoursesRepository(db),
    questions: createQuestionsRepository(db),
    exams: createExamsRepository(db),
    attempts: createAttemptsRepository(db),
    answers: createAnswersRepository(db),
    async ping() {
      await db.query('SELECT 1');
      return true;
    },
    async close() {
      await pool.end();
    }
  };
}

module.exports = { createMySqlRepositories };
