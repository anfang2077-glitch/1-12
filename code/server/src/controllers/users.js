'use strict';

const { asyncHandler, ok, created, ApiError } = require('../utils/response');
const {
  requireBody,
  requireString,
  requireEnum,
  optionalEmail,
  optionalString,
  optionalEnum,
  parsePagination,
  parseId,
  badRequest
} = require('../utils/validate');

const ROLES = ['admin', 'teacher', 'student'];

function has(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

/** 用户管理控制器（仅管理员） */
function createUserController({ userService }) {
  return {
    list: asyncHandler(async (req, res) => {
      const { page, pageSize } = parsePagination(req.query);
      const role = optionalEnum(req.query.role, ROLES, 'role', '参数错误：role 取值必须为 admin/teacher/student');
      const keyword = optionalString(req.query.keyword, 'keyword', { max: 50 }) ?? undefined;
      const data = await userService.list({ role, keyword, page, pageSize });
      return ok(res, data);
    }),

    create: asyncHandler(async (req, res) => {
      const body = requireBody(req.body);
      const username = requireString(body.username, '用户名', {
        min: 3,
        max: 50,
        pattern: /^[A-Za-z0-9_]+$/,
        patternMessage: '参数错误：用户名只能包含字母、数字和下划线'
      });
      const password = requireString(body.password, '密码', { min: 6, max: 32 });
      const realName = requireString(body.realName, '真实姓名', { max: 50 });
      const role = requireEnum(body.role, ROLES, '角色', '参数错误：角色必须为 admin/teacher/student');
      const email = optionalEmail(body.email);
      const data = await userService.create({
        username,
        password,
        realName,
        role,
        email: email ?? null
      });
      return created(res, data);
    }),

    update: asyncHandler(async (req, res) => {
      const id = parseId(req.params.id, '用户 ID');
      const body = requireBody(req.body);
      const patch = {};
      if (has(body, 'realName')) {
        patch.realName = requireString(body.realName, '真实姓名', { max: 50 });
      }
      if (has(body, 'email')) {
        const email = optionalEmail(body.email);
        if (email !== undefined) patch.email = email;
      }
      if (has(body, 'status')) {
        if (body.status !== 0 && body.status !== 1) {
          throw badRequest('参数错误：status 只能为 0 或 1');
        }
        patch.status = body.status;
      }
      if (has(body, 'password')) {
        patch.password = requireString(body.password, '密码', { min: 6, max: 32 });
      }
      if (Object.keys(patch).length === 0) {
        throw badRequest('参数错误：没有需要更新的字段');
      }
      const data = await userService.update(req.user, id, patch);
      return ok(res, data);
    }),

    remove: asyncHandler(async (req, res) => {
      const id = parseId(req.params.id, '用户 ID');
      const data = await userService.remove(req.user, id);
      return ok(res, data);
    })
  };
}

module.exports = { createUserController, ApiError };
