'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

/**
 * 读取环境变量并归一化为配置对象。
 * 测试可直接调用 loadConfig({ ... }) 覆盖默认值。
 * @param {NodeJS.ProcessEnv} env
 * @returns {{env: string, port: number, jwtSecret: string, jwtExpiresIn: string,
 *   driver: 'mysql'|'memory', mysql: object, bodyLimit: string}}
 */
function loadConfig(env = process.env) {
  const driver = String(env.MYSQL_DRIVER || 'memory').trim().toLowerCase();
  return {
    env: env.NODE_ENV || 'development',
    port: Number(env.PORT || 3000),
    jwtSecret: env.JWT_SECRET || 'exam-system-dev-secret-change-me',
    jwtExpiresIn: env.JWT_EXPIRES_IN || '8h',
    driver: driver === 'mysql' ? 'mysql' : 'memory',
    bodyLimit: env.BODY_LIMIT || '1mb',
    mysql: {
      host: env.MYSQL_HOST || '127.0.0.1',
      port: Number(env.MYSQL_PORT || 3306),
      user: env.MYSQL_USER || 'root',
      password: env.MYSQL_PASSWORD || '',
      database: env.MYSQL_DATABASE || 'exam_system',
      connectionLimit: Number(env.MYSQL_CONNECTION_LIMIT || 10),
      timezone: env.MYSQL_TIMEZONE || '+08:00'
    }
  };
}

module.exports = { loadConfig, config: loadConfig() };
