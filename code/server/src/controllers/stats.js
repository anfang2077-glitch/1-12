'use strict';

const { asyncHandler, ok } = require('../utils/response');
const { parseId } = require('../utils/validate');

/** 统计控制器 */
function createStatsController({ statsService }) {
  return {
    overview: asyncHandler(async (req, res) => {
      const data = await statsService.overview(req.user);
      return ok(res, data);
    }),

    exams: asyncHandler(async (req, res) => {
      const data = await statsService.exams(req.user);
      return ok(res, data);
    }),

    examDetail: asyncHandler(async (req, res) => {
      const id = parseId(req.params.id, '考试 ID');
      const data = await statsService.examDetail(req.user, id);
      return ok(res, data);
    }),

    student: asyncHandler(async (req, res) => {
      const id = parseId(req.params.id, '学生 ID');
      const data = await statsService.student(req.user, id);
      return ok(res, data);
    })
  };
}

module.exports = { createStatsController };
