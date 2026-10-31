'use strict';

const { ApiError } = require('../utils/response');
const { hashPassword } = require('../utils/password');
const { toUser } = require('./serializers');

/**
 * 用户管理服务（仅管理员可用；权限由路由中间件保证）。
 */
function createUserService({ repos }) {
  return {
    async list({ role, keyword, page, pageSize }) {
      const result = await repos.users.list({ role, keyword, page, pageSize });
      return {
        list: result.list.map(toUser),
        total: result.total,
        page,
        pageSize
      };
    },

    async create({ username, password, realName, role, email }) {
      const existing = await repos.users.findByUsername(username);
      if (existing) throw ApiError.conflict('用户名已存在');
      const user = await repos.users.create({
        username,
        passwordHash: await hashPassword(password),
        realName,
        role,
        email: email ?? null,
        status: 1
      });
      return toUser(user);
    },

    async update(currentUser, id, patch) {
      const user = await repos.users.findById(id);
      if (!user) throw ApiError.notFound('用户不存在');

      const changes = { ...patch };
      if (changes.status !== undefined && changes.status === 0 && id === currentUser.id) {
        throw ApiError.conflict('不能禁用当前登录账号');
      }
      if (changes.password !== undefined) {
        changes.passwordHash = await hashPassword(changes.password);
        delete changes.password;
      }
      const updated = await repos.users.update(id, changes);
      return toUser(updated);
    },

    async remove(currentUser, id) {
      const user = await repos.users.findById(id);
      if (!user) throw ApiError.notFound('用户不存在');
      if (id === currentUser.id) throw ApiError.conflict('不能删除当前登录账号');

      const [courseCount, examCount, attemptCount] = await Promise.all([
        repos.courses.countByTeacherId(id),
        repos.exams.countByCreatedBy(id),
        repos.attempts.countByStudent(id)
      ]);
      if (courseCount > 0 || examCount > 0 || attemptCount > 0) {
        throw ApiError.conflict('该用户存在关联数据，无法删除，请先禁用');
      }
      await repos.users.remove(id);
      return { id };
    }
  };
}

module.exports = { createUserService };
