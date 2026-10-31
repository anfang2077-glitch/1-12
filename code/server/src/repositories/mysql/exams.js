'use strict';

const EXAM_FIELDS = `e.id, e.title, e.course_id AS courseId, c.name AS courseName, e.description,
  e.start_time AS startTime, e.end_time AS endTime, e.duration_min AS durationMin,
  e.total_score AS totalScore, e.pass_score AS passScore, e.shuffle, e.status,
  e.created_by AS createdBy, e.created_at AS createdAt,
  (SELECT COUNT(*) FROM exam_questions eq WHERE eq.exam_id = e.id) AS questionCount,
  (SELECT COUNT(*) FROM exam_students es WHERE es.exam_id = e.id) AS assignedCount`;

function clone(value) {
  return value ? { ...value } : null;
}

/** MySQL 考试仓储（exam_questions / exam_students 由本仓储维护） */
function createExamsRepository(db) {
  return {
    async findById(id) {
      const rows = await db.query(
        `SELECT ${EXAM_FIELDS} FROM exams e LEFT JOIN courses c ON c.id = e.course_id WHERE e.id = ?`,
        [id]
      );
      return rows[0] || null;
    },

    async list({ status, courseIds } = {}) {
      const where = [];
      const params = [];
      if (status) {
        where.push('e.status = ?');
        params.push(status);
      }
      if (Array.isArray(courseIds)) {
        if (courseIds.length === 0) return [];
        where.push(`e.course_id IN (${courseIds.map(() => '?').join(',')})`);
        params.push(...courseIds);
      }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      return db.query(
        `SELECT ${EXAM_FIELDS} FROM exams e LEFT JOIN courses c ON c.id = e.course_id
         ${whereSql} ORDER BY e.id ASC`,
        params
      );
    },

    async createWithQuestions(examData, examQuestionList) {
      const examId = await db.withTransaction(async (tx) => {
        const result = await tx.query(
          `INSERT INTO exams
           (title, course_id, description, start_time, end_time, duration_min, total_score, pass_score, shuffle, status, created_by)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          [
            examData.title,
            examData.courseId,
            examData.description ?? null,
            examData.startTime,
            examData.endTime,
            examData.durationMin,
            examData.totalScore,
            examData.passScore,
            examData.shuffle ? 1 : 0,
            examData.status || 'draft',
            examData.createdBy
          ]
        );
        const newId = result.insertId;
        for (let index = 0; index < examQuestionList.length; index += 1) {
          const item = examQuestionList[index];
          await tx.query(
            'INSERT INTO exam_questions (exam_id, question_id, score, sort_order) VALUES (?,?,?,?)',
            [newId, item.questionId, item.score, item.sortOrder || index + 1]
          );
        }
        return newId;
      });
      return this.findById(examId);
    },

    async update(id, patch) {
      const columns = {
        title: 'title',
        description: 'description',
        startTime: 'start_time',
        endTime: 'end_time',
        durationMin: 'duration_min',
        totalScore: 'total_score',
        passScore: 'pass_score',
        shuffle: 'shuffle',
        status: 'status'
      };
      const sets = [];
      const params = [];
      for (const [key, column] of Object.entries(columns)) {
        if (Object.prototype.hasOwnProperty.call(patch, key)) {
          sets.push(`${column} = ?`);
          params.push(key === 'shuffle' ? (patch[key] ? 1 : 0) : patch[key]);
        }
      }
      if (sets.length) {
        await db.query(`UPDATE exams SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
      }
      return this.findById(id);
    },

    async replaceQuestions(examId, examQuestionList, totalScore) {
      await db.withTransaction(async (tx) => {
        await tx.query('DELETE FROM exam_questions WHERE exam_id = ?', [examId]);
        for (let index = 0; index < examQuestionList.length; index += 1) {
          const item = examQuestionList[index];
          await tx.query(
            'INSERT INTO exam_questions (exam_id, question_id, score, sort_order) VALUES (?,?,?,?)',
            [examId, item.questionId, item.score, item.sortOrder || index + 1]
          );
        }
        await tx.query('UPDATE exams SET total_score = ? WHERE id = ?', [totalScore, examId]);
      });
      return this.findById(examId);
    },

    async setStatus(id, status) {
      await db.query('UPDATE exams SET status = ? WHERE id = ?', [status, id]);
      return this.findById(id);
    },

    async remove(id) {
      await db.withTransaction(async (tx) => {
        await tx.query('DELETE FROM exam_students WHERE exam_id = ?', [id]);
        await tx.query('DELETE FROM exam_questions WHERE exam_id = ?', [id]);
        await tx.query('DELETE FROM exams WHERE id = ?', [id]);
      });
    },

    async getQuestions(examId) {
      return db.query(
        `SELECT eq.question_id AS questionId, eq.sort_order AS sortOrder, eq.score,
                q.type, q.stem, q.options, q.answer, q.analysis, q.difficulty,
                q.knowledge_point AS knowledgePoint
         FROM exam_questions eq JOIN questions q ON q.id = eq.question_id
         WHERE eq.exam_id = ? ORDER BY eq.sort_order ASC, eq.id ASC`,
        [examId]
      );
    },

    async countQuestions(examId) {
      const rows = await db.query('SELECT COUNT(*) AS total FROM exam_questions WHERE exam_id = ?', [examId]);
      return Number(rows[0].total);
    },

    async countAssigned(examId) {
      const rows = await db.query('SELECT COUNT(*) AS total FROM exam_students WHERE exam_id = ?', [examId]);
      return Number(rows[0].total);
    },

    async isAssigned(examId, studentId) {
      const rows = await db.query(
        'SELECT 1 FROM exam_students WHERE exam_id = ? AND student_id = ? LIMIT 1',
        [examId, studentId]
      );
      return rows.length > 0;
    },

    async getAssignedStudentIds(examId) {
      const rows = await db.query(
        'SELECT student_id AS studentId FROM exam_students WHERE exam_id = ? ORDER BY student_id ASC',
        [examId]
      );
      return rows.map((row) => row.studentId);
    },

    async assignStudents(examId, studentIds) {
      const unique = [...new Set(studentIds)];
      await db.withTransaction(async (tx) => {
        await tx.query('DELETE FROM exam_students WHERE exam_id = ?', [examId]);
        for (const studentId of unique) {
          await tx.query('INSERT INTO exam_students (exam_id, student_id) VALUES (?,?)', [
            examId,
            studentId
          ]);
        }
      });
      return unique;
    },

    async isQuestionUsed(questionId) {
      const rows = await db.query(
        `SELECT e.status FROM exam_questions eq JOIN exams e ON e.id = eq.exam_id
         WHERE eq.question_id = ?`,
        [questionId]
      );
      return {
        any: rows.length > 0,
        active: rows.some((row) => row.status !== 'draft')
      };
    },

    async listForStudent(studentId) {
      return db.query(
        `SELECT ${EXAM_FIELDS}
         FROM exams e
         JOIN exam_students es ON es.exam_id = e.id
         LEFT JOIN courses c ON c.id = e.course_id
         WHERE es.student_id = ? AND e.status = 'published'
         ORDER BY e.start_time ASC, e.id ASC`,
        [studentId]
      );
    },

    async countAll() {
      const rows = await db.query('SELECT COUNT(*) AS total FROM exams');
      return Number(rows[0].total);
    },

    async countByCourseId(courseId) {
      const rows = await db.query('SELECT COUNT(*) AS total FROM exams WHERE course_id = ?', [courseId]);
      return Number(rows[0].total);
    },

    async countByCreatedBy(userId) {
      const rows = await db.query('SELECT COUNT(*) AS total FROM exams WHERE created_by = ?', [userId]);
      return Number(rows[0].total);
    },

    async hasStudentRelation(teacherId, studentId) {
      const rows = await db.query(
        `SELECT 1
         FROM exams e JOIN courses c ON c.id = e.course_id
         WHERE c.teacher_id = ?
           AND (EXISTS (SELECT 1 FROM attempts a WHERE a.exam_id = e.id AND a.student_id = ?)
             OR EXISTS (SELECT 1 FROM exam_students es WHERE es.exam_id = e.id AND es.student_id = ?))
         LIMIT 1`,
        [teacherId, studentId, studentId]
      );
      return rows.length > 0;
    }
  };
}

module.exports = { createExamsRepository };
