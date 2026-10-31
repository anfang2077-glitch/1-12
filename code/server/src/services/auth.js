'use strict';

const { ApiError } = require('../utils/response');
const { verifyPassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');
const { toLoginUser, toUser } = require('./serializers');

/**
 * 认证服务：登录签发 JWT、查询当前用户。
 */
function createAuthService({ repos, config }) {
  return {
    async login(username, password) {
      const user = await repos.users.findByUsername(username);
      if (!user) {
        throw ApiError.unauthorized('用户名或密码错误');
      }
      const matched = await verifyPassword(password, user.passwordHash);
      if (!matched) {
        throw ApiError.unauthorized('用户名或密码错误');
      }
      if (Number(user.status) !== 1) {
        throw ApiError.forbidden('该账号已被禁用，请联系管理员');
      }
      return {
        token: signToken(user, config),
        user: toLoginUser(user)
      };
    },

    async me(userId) {
      const user = await repos.users.findById(userId);
      if (!user || Number(user.status) !== 1) {
        throw ApiError.unauthorized('账号状态异常，请重新登录');
      }
      return toUser(user);
    }
  };
}

module.exports = { createAuthService };
