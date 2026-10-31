'use strict';

const { asyncHandler, ok, ApiError } = require('../utils/response');
const { requireBody, requireString, badRequest } = require('../utils/validate');

/** 认证控制器：只做参数校验，登录态由 auth 中间件处理 */
function createAuthController({ authService }) {
  return {
    login: asyncHandler(async (req, res) => {
      const body = requireBody(req.body);
      if (!body.username || !body.password) {
        throw badRequest('参数错误：用户名和密码不能为空');
      }
      const username = requireString(body.username, '用户名', { max: 50 });
      const password = requireString(body.password, '密码', { max: 100, trim: false });
      const data = await authService.login(username, password);
      return ok(res, data);
    }),

    me: asyncHandler(async (req, res) => {
      const data = await authService.me(req.user.id);
      return ok(res, data);
    })
  };
}

module.exports = { createAuthController };
