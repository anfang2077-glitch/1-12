'use strict';

const { formatDateTime } = require('./time');

/**
 * 业务错误：携带 HTTP 状态码与业务码，由 errorHandler 统一序列化。
 * 失败响应只包含 code 与 message（契约 C-3）。
 */
class ApiError extends Error {
  /**
   * @param {number} status HTTP 状态码
   * @param {number} code 业务码
   * @param {string} message 中文提示
   */
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  static badRequest(message) {
    return new ApiError(400, 40001, message);
  }

  static unauthorized(message = '未登录或登录已过期') {
    return new ApiError(401, 40101, message);
  }

  static forbidden(message = '无权限访问该资源') {
    return new ApiError(403, 40301, message);
  }

  static notFound(message = '资源不存在') {
    return new ApiError(404, 40401, message);
  }

  static conflict(message = '状态冲突') {
    return new ApiError(409, 40901, message);
  }
}

/** 成功响应（HTTP 200） */
function ok(res, data) {
  return res.status(200).json({ code: 0, message: 'ok', data });
}

/** 创建成功响应（HTTP 201） */
function created(res, data) {
  return res.status(201).json({ code: 0, message: 'ok', data });
}

/** 异步控制器包装：把 Promise 异常交给 Express 错误中间件 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/** 统一时间序列化辅助（供服务层复用） */
const serializeTime = (value) => (value ? formatDateTime(value) : null);

module.exports = { ApiError, ok, created, asyncHandler, serializeTime };
