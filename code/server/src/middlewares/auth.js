'use strict';

const { ApiError, asyncHandler } = require('../utils/response');
const { verifyToken } = require('../utils/jwt');

/**
 * JWT 鉴权中间件：校验 Authorization: Bearer <token>，
 * 并通过数据库中的最新用户状态判断账号是否有效。
 */
function createAuthenticate({ repos, config }) {
  return asyncHandler(async (req, res, next) => {
    const header = req.headers.authorization;
    if (typeof header !== 'string' || !/^Bearer\s+\S+/i.test(header)) {
      throw ApiError.unauthorized('未登录或登录已过期');
    }
    const token = header.replace(/^Bearer\s+/i, '').trim();
    const payload = verifyToken(token, config.jwtSecret);
    const user = await repos.users.findById(Number(payload.sub));
    if (!user || Number(user.status) !== 1) {
      throw ApiError.unauthorized('账号状态异常，请重新登录');
    }
    req.user = user;
    next();
  });
}

/** 角色白名单中间件 */
function authorize(...roles) {
  return function roleGuard(req, res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(ApiError.forbidden('无权限访问该资源'));
    }
    return next();
  };
}

module.exports = { createAuthenticate, authorize };
