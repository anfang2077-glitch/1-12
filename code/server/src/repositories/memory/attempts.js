'use strict';

function clone(value) {
  return value ? { ...value } : null;
}

/** 内存答卷仓储 */
function createAttemptsRepository(store) {
  const rows = store.tables.attempts;

  return {
    async findById(id) {
      return clone(rows.find((item) => item.id === id));
    },

    async findByExamAndStudent(examId, studentId) {
      return clone(rows.find((item) => item.examId === examId && item.studentId === studentId));
    },

    async create(data) {
      const attempt = {
        id: store.nextId('attempts'),
        examId: data.examId,
        studentId: data.studentId,
        startedAt: data.startedAt,
        submittedAt: data.submittedAt ?? null,
        deadlineAt: data.deadlineAt,
        status: data.status || 'in_progress',
        objectiveScore: data.objectiveScore ?? 0,
        subjectiveScore: data.subjectiveScore ?? 0,
        totalScore: data.totalScore ?? 0
      };
      rows.push(attempt);
      return clone(attempt);
    },

    async update(id, patch) {
      const attempt = rows.find((item) => item.id === id);
      if (!attempt) return null;
      Object.assign(attempt, patch);
      return clone(attempt);
    },

    async listByStudent(studentId) {
      return rows
        .filter((item) => item.studentId === studentId)
        .sort((a, b) => a.id - b.id)
        .map(clone);
    },

    async listByExamIds(examIds, statuses) {
      if (!Array.isArray(examIds) || examIds.length === 0) return [];
      const allowedExams = new Set(examIds);
      const allowedStatuses = statuses ? new Set(statuses) : null;
      return rows
        .filter(
          (item) =>
            allowedExams.has(item.examId) && (!allowedStatuses || allowedStatuses.has(item.status))
        )
        .sort((a, b) => a.id - b.id)
        .map(clone);
    },

    async countByExam(examId) {
      return rows.filter((item) => item.examId === examId).length;
    },

    async countByStudent(studentId) {
      return rows.filter((item) => item.studentId === studentId).length;
    },

    async countAll() {
      return rows.length;
    }
  };
}

module.exports = { createAttemptsRepository };
