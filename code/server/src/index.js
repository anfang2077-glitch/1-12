'use strict';

const { loadConfig } = require('./config');
const createApp = require('./app');
const { createMemoryRepositories, createMySqlRepositories } = require('./repositories');
const { seedMemory } = require('./db/seed');

/**
 * 启动入口：
 * - MYSQL_DRIVER=mysql（或默认配置）连接 MySQL；
 * - --memory 参数或 MYSQL_DRIVER=memory 使用内存仓储并自动写入演示种子数据。
 */
async function main() {
  const config = loadConfig();
  const useMemory = process.argv.includes('--memory') || config.driver === 'memory';

  let repos;
  if (useMemory) {
    repos = createMemoryRepositories();
    await seedMemory(repos);
    console.log('[server] 运行模式：memory（无需 MySQL），已写入演示种子数据');
  } else {
    repos = createMySqlRepositories(config.mysql);
    await repos.ping();
    console.log(
      `[server] 运行模式：mysql（${config.mysql.host}:${config.mysql.port}/${config.mysql.database}）`
    );
  }

  const app = createApp({ repos, config });
  const server = app.listen(config.port, () => {
    console.log(`[server] API 已启动：http://localhost:${config.port}/api`);
  });

  const shutdown = async (signal) => {
    console.log(`[server] 收到 ${signal}，正在关闭...`);
    server.close(async () => {
      try {
        await repos.close();
      } finally {
        process.exit(0);
      }
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('[server] 启动失败：', error.message);
  if (error.code === 'ECONNREFUSED') {
    console.error('[server] 提示：无 MySQL 环境时请使用 npm run start:memory');
  }
  process.exit(1);
});
