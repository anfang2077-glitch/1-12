'use strict';

const { asyncHandler, ok } = require('../utils/response');
const { requireBody, optionalInt, parseId } = require('../utils/validate');

/** 阅卷控制器 */
function createGradingController({ gradingService }) {
  return {
    pending: asyncHandler(async (req, res) => {
      const examId = optionalInt(req.query.examId, 'examId', { min: 1 });
      const data = await gradingService.pending(req.user, examId);
      return ok(res, data);
    }),

    detail: asyncHandler(async (req, res) => {
      const attemptId = parseId(req.params.attemptId, '答卷 ID');
      const data = await gradingService.detail(req.user, attemptId);
      return ok(res, data);
    }),

    grade: asyncHandler(async (req, res) => {
      const attemptId = parseId(req.params.attemptId, '答卷 ID');
      const body = requireBody(req.body);
      const data = await gradingService.grade(req.user, attemptId, body.items);
      return ok(res, data);
    })
  };
}

module.exports = { createGradingController };
