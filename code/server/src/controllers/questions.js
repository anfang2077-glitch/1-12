'use strict';

const { asyncHandler, ok, created } = require('../utils/response');
const { requireBody, requireInt, parsePagination, parseId, badRequest } = require('../utils/validate');

/** 题库控制器 */
function createQuestionController({ questionService }) {
  return {
    list: asyncHandler(async (req, res) => {
      const { page, pageSize } = parsePagination(req.query);
      const data = await questionService.list(req.user, { ...req.query, page, pageSize });
      return ok(res, data);
    }),

    create: asyncHandler(async (req, res) => {
      const body = requireBody(req.body);
      const data = await questionService.create(req.user, body);
      return created(res, data);
    }),

    update: asyncHandler(async (req, res) => {
      const id = parseId(req.params.id, '题目 ID');
      const body = requireBody(req.body);
      const data = await questionService.update(req.user, id, body);
      return ok(res, data);
    }),

    remove: asyncHandler(async (req, res) => {
      const id = parseId(req.params.id, '题目 ID');
      const data = await questionService.remove(req.user, id);
      return ok(res, data);
    }),

    importQuestions: asyncHandler(async (req, res) => {
      const body = requireBody(req.body);
      const courseId = requireInt(body.courseId, '课程 ID', { min: 1 });
      if (!Array.isArray(body.questions) || body.questions.length === 0) {
        throw badRequest('参数错误：导入题目列表不能为空');
      }
      if (body.questions.length > 500) {
        throw badRequest('参数错误：单次最多导入 500 道题');
      }
      const data = await questionService.importQuestions(req.user, courseId, body.questions);
      return ok(res, data);
    })
  };
}

module.exports = { createQuestionController };
