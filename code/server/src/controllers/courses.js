'use strict';

const { asyncHandler, ok, created } = require('../utils/response');
const {
  requireBody,
  requireString,
  optionalString,
  optionalInt,
  parseId,
  badRequest
} = require('../utils/validate');

const CODE_PATTERN = /^[A-Za-z0-9-]+$/;

function has(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function readName(body) {
  return requireString(body.name, '课程名', { max: 100 });
}

function readCode(body) {
  return requireString(body.code, '课程代码', {
    min: 2,
    max: 30,
    pattern: CODE_PATTERN,
    patternMessage: '参数错误：课程代码只能包含字母、数字和连字符'
  });
}

/** 课程控制器 */
function createCourseController({ courseService }) {
  return {
    list: asyncHandler(async (req, res) => {
      const data = await courseService.list(req.user);
      return ok(res, data);
    }),

    create: asyncHandler(async (req, res) => {
      const body = requireBody(req.body);
      const data = await courseService.create(req.user, {
        name: readName(body),
        code: readCode(body),
        description: optionalString(body.description, '课程简介', { max: 500 }) ?? null,
        teacherId: optionalInt(body.teacherId, 'teacherId', { min: 1 })
      });
      return created(res, data);
    }),

    update: asyncHandler(async (req, res) => {
      const id = parseId(req.params.id, '课程 ID');
      const body = requireBody(req.body);
      const patch = {};
      if (has(body, 'name')) patch.name = readName(body);
      if (has(body, 'code')) patch.code = readCode(body);
      if (has(body, 'description')) {
        patch.description = optionalString(body.description, '课程简介', { max: 500 }) ?? null;
      }
      if (has(body, 'teacherId')) {
        patch.teacherId = optionalInt(body.teacherId, 'teacherId', { min: 1 });
      }
      if (Object.keys(patch).length === 0) {
        throw badRequest('参数错误：没有需要更新的字段');
      }
      const data = await courseService.update(req.user, id, patch);
      return ok(res, data);
    }),

    remove: asyncHandler(async (req, res) => {
      const id = parseId(req.params.id, '课程 ID');
      const data = await courseService.remove(id);
      return ok(res, data);
    })
  };
}

module.exports = { createCourseController };
