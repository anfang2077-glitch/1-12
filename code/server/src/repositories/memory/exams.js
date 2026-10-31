'use strict';

function clone(value) {
  return value ? { ...value } : null;
}

/** 内存考试仓储（含 exam_questions / exam_students 关系表） */
function createExamsRepository(store) {
  const rows = store.tables.exams;
  const examQuestions = store.tables.examQuestions;
  const examStudents = store.tables.examStudents;
  const questions = store.tables.questions;
  const courses = store.tables.courses;
  const attempts = store.tables.attempts;

  const decorate = (exam) => {
    if (!exam) return null;
    const course = courses.find((item) => item.id === exam.courseId);
    return {
      ...exam,
      courseName: course ? course.name : null,
      questionCount: examQuestions.filter((item) => item.examId === exam.id).length,
      assignedCount: examStudents.filter((item) => item.examId === exam.id).length
    };
  };

  return {
    async findById(id) {
      return decorate(rows.find((item) => item.id === id));
    },

    async list({ status, courseIds } = {}) {
      let result = rows.slice();
      if (status) result = result.filter((item) => item.status === status);
      if (Array.isArray(courseIds)) {
        const allowed = new Set(courseIds);
        result = result.filter((item) => allowed.has(item.courseId));
      }
      return result.sort((a, b) => a.id - b.id).map(decorate);
    },

    async createWithQuestions(examData, examQuestionList) {
      const exam = {
        id: store.nextId('exams'),
        title: examData.title,
        courseId: examData.courseId,
        description: examData.description ?? null,
        startTime: examData.startTime,
        endTime: examData.endTime,
        durationMin: examData.durationMin,
        totalScore: examData.totalScore,
        passScore: examData.passScore,
        shuffle: Boolean(examData.shuffle),
        status: examData.status || 'draft',
        createdBy: examData.createdBy,
        createdAt: examData.createdAt || store.now()
      };
      rows.push(exam);
      examQuestionList.forEach((item, index) => {
        examQuestions.push({
          id: store.nextId('examQuestions'),
          examId: exam.id,
          questionId: item.questionId,
          score: item.score,
          sortOrder: item.sortOrder || index + 1
        });
      });
      return decorate(exam);
    },

    async update(id, patch) {
      const exam = rows.find((item) => item.id === id);
      if (!exam) return null;
      Object.assign(exam, patch);
      return decorate(exam);
    },

    async replaceQuestions(examId, examQuestionList, totalScore) {
      for (let index = examQuestions.length - 1; index >= 0; index -= 1) {
        if (examQuestions[index].examId === examId) examQuestions.splice(index, 1);
      }
      examQuestionList.forEach((item, index) => {
        examQuestions.push({
          id: store.nextId('examQuestions'),
          examId,
          questionId: item.questionId,
          score: item.score,
          sortOrder: item.sortOrder || index + 1
        });
      });
      const exam = rows.find((item) => item.id === examId);
      if (exam) exam.totalScore = totalScore;
      return decorate(exam);
    },

    async setStatus(id, status) {
      const exam = rows.find((item) => item.id === id);
      if (!exam) return null;
      exam.status = status;
      return decorate(exam);
    },

    async remove(id) {
      const index = rows.findIndex((item) => item.id === id);
      if (index >= 0) rows.splice(index, 1);
      for (let i = examQuestions.length - 1; i >= 0; i -= 1) {
        if (examQuestions[i].examId === id) examQuestions.splice(i, 1);
      }
      for (let i = examStudents.length - 1; i >= 0; i -= 1) {
        if (examStudents[i].examId === id) examStudents.splice(i, 1);
      }
    },

    async getQuestions(examId) {
      return examQuestions
        .filter((item) => item.examId === examId)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
        .map((item) => {
          const question = questions.find((q) => q.id === item.questionId);
          if (!question) return null;
          return {
            questionId: question.id,
            sortOrder: item.sortOrder,
            score: item.score,
            type: question.type,
            stem: question.stem,
            options: question.options,
            answer: question.answer,
            analysis: question.analysis,
            difficulty: question.difficulty,
            knowledgePoint: question.knowledgePoint
          };
        })
        .filter(Boolean);
    },

    async countQuestions(examId) {
      return examQuestions.filter((item) => item.examId === examId).length;
    },

    async countAssigned(examId) {
      return examStudents.filter((item) => item.examId === examId).length;
    },

    async isAssigned(examId, studentId) {
      return examStudents.some((item) => item.examId === examId && item.studentId === studentId);
    },

    async getAssignedStudentIds(examId) {
      return examStudents
        .filter((item) => item.examId === examId)
        .sort((a, b) => a.studentId - b.studentId)
        .map((item) => item.studentId);
    },

    async assignStudents(examId, studentIds) {
      for (let index = examStudents.length - 1; index >= 0; index -= 1) {
        if (examStudents[index].examId === examId) examStudents.splice(index, 1);
      }
      const unique = [...new Set(studentIds)];
      unique.forEach((studentId) => {
        examStudents.push({ id: store.nextId('examStudents'), examId, studentId });
      });
      return unique;
    },

    async isQuestionUsed(questionId) {
      let any = false;
      let active = false;
      for (const relation of examQuestions) {
        if (relation.questionId !== questionId) continue;
        const exam = rows.find((item) => item.id === relation.examId);
        if (!exam) continue;
        any = true;
        if (exam.status !== 'draft') active = true;
      }
      return { any, active };
    },

    async listForStudent(studentId) {
      const assignedExamIds = new Set(
        examStudents.filter((item) => item.studentId === studentId).map((item) => item.examId)
      );
      return rows
        .filter((item) => item.status === 'published' && assignedExamIds.has(item.id))
        .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)) || a.id - b.id)
        .map(decorate);
    },

    async countAll() {
      return rows.length;
    },

    async countByCourseId(courseId) {
      return rows.filter((item) => item.courseId === courseId).length;
    },

    async countByCreatedBy(userId) {
      return rows.filter((item) => item.createdBy === userId).length;
    },

    async hasStudentRelation(teacherId, studentId) {
      const courseIds = new Set(
        courses.filter((item) => item.teacherId === teacherId).map((item) => item.id)
      );
      const teacherExams = rows.filter((item) => courseIds.has(item.courseId));
      return teacherExams.some(
        (exam) =>
          examStudents.some((item) => item.examId === exam.id && item.studentId === studentId) ||
          attempts.some((item) => item.examId === exam.id && item.studentId === studentId)
      );
    }
  };
}

module.exports = { createExamsRepository };
