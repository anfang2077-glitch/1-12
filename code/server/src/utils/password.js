'use strict';

const bcrypt = require('bcryptjs');

/** bcrypt 代价因子（基线 4.1 要求 cost=10） */
const BCRYPT_ROUNDS = 10;

/** 异步哈希密码 */
function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/** 异步校验密码 */
function verifyPassword(plain, passwordHash) {
  if (!passwordHash) return Promise.resolve(false);
  return bcrypt.compare(plain, passwordHash);
}

/** 同步哈希（仅用于种子脚本，避免脚本启动时异步开销叠加） */
function hashPasswordSync(plain) {
  return bcrypt.hashSync(plain, BCRYPT_ROUNDS);
}

module.exports = { BCRYPT_ROUNDS, hashPassword, verifyPassword, hashPasswordSync };
