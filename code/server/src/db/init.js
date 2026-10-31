'use strict';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { loadConfig } = require('../config');

/**
 * 执行 db/schema.sql：创建数据库与 8 张表（会先删表，仅用于开发环境）。
 */
async function main() {
  const config = loadConfig();
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const connection = await mysql.createConnection({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    multipleStatements: true,
    charset: 'utf8mb4_general_ci'
  });
  try {
    await connection.query(sql);
    console.log(`[db:init] 数据库 ${config.mysql.database} 及 8 张表已创建`);
    console.log('[db:init] 下一步：npm run db:seed 写入种子数据');
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[db:init] 失败：', error.message);
    process.exitCode = 1;
  });
}

module.exports = { main };
