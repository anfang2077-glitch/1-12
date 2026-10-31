'use strict';

const { ApiError } = require('../utils/response');
const { toCourse } = require('./serializers');

/**
 * 课程服务：管理员全量，教师仅本人课程，学生只读全部。
 */
function createCourseService({ repos }) {
  async function requireCourse(id) {
    const course = await repos.courses.findById(id);
    if (!course) throw ApiError.notFound('课程不存在');
    return course;
  }

  async function assertTeacher(targetTeacherId) {
    const teacher = await repos.users.findById(targetTeacherId);
    if (!teacher || teacher.role !== 'teacher') {
      throw ApiError.badRequest('参数错误：指定的教师不存在');
    }
    return teacher;
  }

  return {
    async list(currentUser) {
      if (currentUser.role === 'teacher') {
        const list = await repos.courses.listByTeacherId(currentUser.id);
        return list.map(toCourse);
      }
      const list = await repos.courses.listAll();
      return list.map(toCourse);
    },

    async create(currentUser, payload) {
      let teacherId = currentUser.id;
      if (currentUser.role === 'admin') {
        if (payload.teacherId !== undefined) {
          await assertTeacher(payload.teacherId);
          teacherId = payload.teacherId;
        }
      } else if (payload.teacherId !== undefined) {
        // 教师创建课程时强制归属自己，忽略传入的 teacherId
        teacherId = currentUser.id;
      }

      const existing = await repos.courses.findByCode(payload.code);
      if (existing) throw ApiError.conflict('课程代码已存在');

      const course = await repos.courses.create({
        name: payload.name,
        code: payload.code,
        description: payload.description ?? null,
        teacherId
      });
      return toCourse(course);
    },

    async update(currentUser, id, payload) {
      const course = await requireCourse(id);
      if (currentUser.role === 'teacher' && course.teacherId !== currentUser.id) {
        throw ApiError.forbidden('无权限操作该课程');
      }

      const changes = { ...payload };
      // 教师不可把课程转给他人
      if (currentUser.role !== 'admin') delete changes.teacherId;
      if (changes.teacherId !== undefined) await assertTeacher(changes.teacherId);

      if (changes.code !== undefined) {
        const existing = await repos.courses.findByCode(changes.code);
        if (existing && existing.id !== id) throw ApiError.conflict('课程代码已存在');
      }

      const updated = await repos.courses.update(id, changes);
      return toCourse(updated);
    },

    async remove(id) {
      const course = await requireCourse(id);
      const [questionCount, examCount] = await Promise.all([
        repos.questions.countByCourseId(id),
        repos.exams.countByCourseId(id)
      ]);
      if (questionCount > 0) throw ApiError.conflict('该课程下存在题目，无法删除');
      if (examCount > 0) throw ApiError.conflict('该课程下存在考试，无法删除');
      await repos.courses.remove(course.id);
      return { id };
    }
  };
}

module.exports = { createCourseService };
