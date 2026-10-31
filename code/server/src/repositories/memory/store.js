'use strict';

const { formatDateTime } = require('../../utils/time');

const TABLES = ['users', 'courses', 'questions', 'exams', 'examQuestions', 'examStudents', 'attempts', 'answers'];

/**
 * 内存数据仓库：与 MySQL 实现共享同一批 Repository 方法签名，
 * 用于无数据库环境下的单元测试与演示模式。
 */
function createStore() {
  const store = {
    tables: {},
    sequences: {},
    nextId(table) {
      const current = Number(this.sequences[table] || 0) + 1;
      this.sequences[table] = current;
      return current;
    },
    now() {
      return formatDateTime(new Date());
    }
  };
  for (const table of TABLES) {
    store.tables[table] = [];
    store.sequences[table] = 0;
  }
  return store;
}

module.exports = { createStore, TABLES };
