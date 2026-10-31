'use strict';

const { asyncHandler, ok, created } = require('../utils/response');
const { requireBody, parseId } = require('../utils/validate');

/** 考试控制器 */
function createExamController({ examService }) {
  return {
    list: asyncHandler(async (req, res) => {
      const data = await examService.list(req.user, req.query);
      return ok(res, data);
    }),

    create: asyncHandler(async (req, res) => {
      const body = requireBody(req.body);
      const data = await examService.create(req.user, body);
      return created(res, data);
    }),

    detail: asyncHandler(async (req, res) => {
      const id = parseId(req.params.id, '考试 ID');
      const data = await examService.detail(req.user, id);
      return ok(res, data);
    }),

    update: asyncHandler(async (req, res) => {
      const id = parseId(req.params.id, '考试 ID');
      const body = requireBody(req.body);
      const data = await examService.update(req.user, id, body);
      return ok(res, data);
    }),

    remove: asyncHandler(async (req, res) => {
      const id = parseId(req.params.id, '考试 ID');
      const data = await examService.remove(req.user, id);
      return ok(res, data);
    }),

    publish: asyncHandler(async (req, res) => {
      const id = parseId(req.params.id, '考试 ID');
      const data = await examService.publish(req.user, id);
      return ok(res, data);
    }),

    assign: asyncHandler(async (req, res) => {
      const id = parseId(req.params.id, '考试 ID');
      const body = requireBody(req.body);
      const data = await examService.assign(req.user, id, body.studentIds);
      return ok(res, data);
    }),

    available: asyncHandler(async (req, res) => {
      const data = await examService.available(req.user);
      return ok(res, data);
    }),

    paper: asyncHandler(async (req, res) => {
      const id = parseId(req.params.id, '考试 ID');
      const data = await examService.paper(req.user, id);
      return ok(res, data);
    }),

    start: asyncHandler(async (req, res) => {
      const id = parseId(req.params.id, '考试 ID');
      const { created: isCreated, ...data } = await examService.start(req.user, id);
      return isCreated ? created(res, data) : ok(res, data);
    })
  };
}

module.exports = { createExamController };
