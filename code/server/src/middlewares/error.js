'use strict';

const { ApiError } = require('../utils/response');

/**
 * 统一错误处理中间件：失败响应只含 code 与 message（契约 C-3）。
 */
function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error instanceof ApiError) {
    return res.status(error.status).json({ code: error.code, message: error.message });
  }
  if (error && error.type === 'entity.parse.failed') {
    return res.status(400).json({ code: 40001, message: '参数错误：请求体不是合法的 JSON' });
  }
  if (error && error.type === 'entity.too.large') {
    return res
      .status(400)
      .json({ code: 40001, message: '请求体过大，单次导入请不超过 500 道题' });
  }
  // 未预期异常：打印堆栈，返回 50001，不泄露内部细节
  console.error(`[error][${req.requestId || '-'}]`, error);
  return res.status(500).json({ code: 50001, message: '服务器内部错误' });
}

module.exports = { errorHandler };
