'use strict';

function clone(value) {
  return value ? { ...value } : null;
}

/** 内存题库仓储 */
function createQuestionsRepository(store) {
  const rows = store.tables.questions;

  return {
    async findById(id) {
      return clone(rows.find((item) => item.id === id));
    },

    async list({ courseIds, courseId, type, difficulty, keyword, page, pageSize }) {
      let result = rows.slice();
      if (Array.isArray(courseIds)) {
        const allowed = new Set(courseIds);
        result = result.filter((item) => allowed.has(item.courseId));
      }
      if (courseId) result = result.filter((item) => item.courseId === courseId);
      if (type) result = result.filter((item) => item.type === type);
      if (difficulty) result = result.filter((item) => item.difficulty === difficulty);
      if (keyword) {
        const text = String(keyword).toLowerCase();
        result = result.filter((item) => item.stem.toLowerCase().includes(text));
      }
      result.sort((a, b) => a.id - b.id);
      const total = result.length;
      const start = (page - 1) * pageSize;
      return { list: result.slice(start, start + pageSize).map(clone), total };
    },

    async create(data) {
      const question = {
        id: store.nextId('questions'),
        courseId: data.courseId,
        type: data.type,
        stem: data.stem,
        options: data.options ?? null,
        answer: data.answer,
        score: data.score,
        difficulty: data.difficulty,
        knowledgePoint: data.knowledgePoint ?? null,
        analysis: data.analysis ?? null,
        creatorId: data.creatorId ?? null,
        createdAt: data.createdAt || store.now()
      };
      rows.push(question);
      return clone(question);
    },

    async update(id, patch) {
      const question = rows.find((item) => item.id === id);
      if (!question) return null;
      Object.assign(question, patch);
      return clone(question);
    },

    async remove(id) {
      const index = rows.findIndex((item) => item.id === id);
      if (index >= 0) rows.splice(index, 1);
    },

    async countAll() {
      return rows.length;
    },

    async countByCourseId(courseId) {
      return rows.filter((item) => item.courseId === courseId).length;
    }
  };
}

module.exports = { createQuestionsRepository };
