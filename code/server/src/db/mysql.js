'use strict';

const mysql = require('mysql2/promise');

/**
 * 创建 mysql2 连接池。
 * dateStrings 让 DATETIME 直接返回 YYYY-MM-DD HH:mm:ss，与内存仓储保持一致；
 * decimalNumbers 让 DECIMAL 返回 number，避免前端收到字符串。
 * @param {object} mysqlConfig
 */
function createPool(mysqlConfig) {
  return mysql.createPool({
    host: mysqlConfig.host,
    port: mysqlConfig.port,
    user: mysqlConfig.user,
    password: mysqlConfig.password,
    database: mysqlConfig.database,
    waitForConnections: true,
    connectionLimit: mysqlConfig.connectionLimit || 10,
    queueLimit: 0,
    charset: 'utf8mb4_general_ci',
    timezone: mysqlConfig.timezone || '+08:00',
    dateStrings: true,
    decimalNumbers: true,
    multipleStatements: false
  });
}

function wrapConnection(connection) {
  return {
    async query(sql, params = []) {
      const [rows] = await connection.query(sql, params);
      return rows;
    }
  };
}

/**
 * 事务辅助：自动 begin / commit / rollback，并释放连接。
 * @template T
 * @param {import('mysql2/promise').Pool} pool
 * @param {(tx: {query: Function}) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withTransaction(pool, fn) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(wrapConnection(connection));
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (_) {
      // 回滚失败不掩盖原始异常
    }
    throw error;
  } finally {
    connection.release();
  }
}

/** 统一的查询入口（连接池 + 事务） */
function createDb(pool) {
  return {
    pool,
    async query(sql, params = []) {
      const [rows] = await pool.query(sql, params);
      return rows;
    },
    withTransaction(fn) {
      return withTransaction(pool, fn);
    }
  };
}

module.exports = { createPool, createDb, withTransaction };
