'use strict';

const { asyncHandler, ok } = require('../utils/response');
const { requireBody, requireInt, parseId, badRequest } = require('../utils/validate');

/** 答题与交卷控制器 */
function createAttemptController({ attemptService }) {
  return {
    get: asyncHandler(async (req, res) => {
      const id = parseId(req.params.id, '答卷 ID');
      const data = await attemptService.get(req.user, id);
      return ok(res, data);
    }),

    saveAnswer: asyncHandler(async (req, res) => {
      const id = parseId(req.params.id, '答卷 ID');
      const body = requireBody(req.body);
      const questionId = requireInt(body.questionId, 'questionId', { min: 1 });
      if (!Object.prototype.hasOwnProperty.call(body, 'answer')) {
        throw badRequest('参数错误：answer 不能为空');
      }
      const data = await attemptService.saveAnswer(req.user, id, questionId, body.answer);
      return ok(res, data);
    }),

    submit: asyncHandler(async (req, res) => {
      const id = parseId(req.params.id, '答卷 ID');
      const data = await attemptService.submit(req.user, id);
      return ok(res, data);
    }),

    result: asyncHandler(async (req, res) => {
      const id = parseId(req.params.id, '答卷 ID');
      const data = await attemptService.result(req.user, id);
      return ok(res, data);
    })
  };
}

module.exports = { createAttemptController };
