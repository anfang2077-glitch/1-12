'use strict';

const jwt = require('jsonwebtoken');
const { ApiError } = require('./response');

/**
 * 签发 JWT：payload 固定为 { sub, username, role }，默认 8 小时（契约 5.1）。
 * @param {{id:number, username:string, role:string}} user
 * @param {{jwtSecret:string, jwtExpiresIn?:string}} config
 */
function signToken(user, config) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn || '8h', algorithm: 'HS256' }
  );
}

/**
 * 校验 JWT。失败统一抛出 40101，过期与非法令牌给出不同中文提示。
 * @returns {object} payload
 */
function verifyToken(token, secret) {
  try {
    return jwt.verify(token, secret, { algorithms: ['HS256'] });
  } catch (error) {
    if (error && error.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('登录状态已失效，请重新登录');
    }
    throw ApiError.unauthorized('未登录或登录已过期');
  }
}

module.exports = { signToken, verifyToken };
