'use strict';

function clone(value) {
  return value ? { ...value } : null;
}

/** 内存课程仓储 */
function createCoursesRepository(store) {
  const rows = store.tables.courses;
  const users = store.tables.users;

  const decorate = (course) =>
    course
      ? {
          ...course,
          teacherName: (users.find((user) => user.id === course.teacherId) || {}).realName || null
        }
      : null;

  return {
    async findById(id) {
      return decorate(rows.find((item) => item.id === id));
    },

    async findByCode(code) {
      return clone(rows.find((item) => item.code === code));
    },

    async listAll() {
      return rows.slice().sort((a, b) => a.id - b.id).map(decorate);
    },

    async listByTeacherId(teacherId) {
      return rows
        .filter((item) => item.teacherId === teacherId)
        .sort((a, b) => a.id - b.id)
        .map(decorate);
    },

    async create(data) {
      const course = {
        id: store.nextId('courses'),
        name: data.name,
        code: data.code,
        description: data.description ?? null,
        teacherId: data.teacherId,
        createdAt: data.createdAt || store.now()
      };
      rows.push(course);
      return decorate(course);
    },

    async update(id, patch) {
      const course = rows.find((item) => item.id === id);
      if (!course) return null;
      Object.assign(course, patch);
      return decorate(course);
    },

    async remove(id) {
      const index = rows.findIndex((item) => item.id === id);
      if (index >= 0) rows.splice(index, 1);
    },

    async countByTeacherId(teacherId) {
      return rows.filter((item) => item.teacherId === teacherId).length;
    }
  };
}

module.exports = { createCoursesRepository };
