'use strict';

const express = require('express');
const cors = require('cors');
const { requestId } = require('./middlewares/requestId');
const { errorHandler } = require('./middlewares/error');
const createApiRouter = require('./routes');

/**
 * Express 应用工厂：注入仓储、配置与时钟，便于 supertest 使用内存仓储。
 * @param {{repos: object, config: object, clock?: () => Date}} deps
 * @returns {import('express').Express}
 */
function createApp({ repos, config, clock = () => new Date() }) {
  if (!repos) throw new Error('createApp 需要注入 repos');
  if (!config) throw new Error('createApp 需要注入 config');

  const app = express();
  app.disable('x-powered-by');
  app.use(requestId);
  app.use(cors());
  app.use(express.json({ limit: config.bodyLimit || '1mb' }));
  app.use('/api', createApiRouter({ repos, config, clock }));

  // 未命中任何路由
  app.use((req, res) => {
    res.status(404).json({ code: 40401, message: '资源不存在' });
  });
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
