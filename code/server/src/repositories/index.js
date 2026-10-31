'use strict';

const { createMemoryRepositories } = require('./memory');
const { createMySqlRepositories } = require('./mysql');

/**
 * 根据驱动装配仓储。MYSQL_DRIVER=mysql 使用 MySQL；其余一律使用内存实现。
 * @param {object} config 完整配置对象
 */
function createRepositories(config) {
  if (config.driver === 'mysql') {
    return createMySqlRepositories(config.mysql);
  }
  return createMemoryRepositories();
}

module.exports = { createRepositories, createMemoryRepositories, createMySqlRepositories };
