'use strict';

const ATTEMPT_FIELDS = `id, exam_id AS examId, student_id AS studentId, started_at AS startedAt,
  submitted_at AS submittedAt, deadline_at AS deadlineAt, status, objective_score AS objectiveScore,
  subjective_score AS subjectiveScore, total_score AS totalScore`;

/** MySQL 答卷仓储 */
function createAttemptsRepository(db) {
  return {
    async findById(id) {
      const rows = await db.query(`SELECT ${ATTEMPT_FIELDS} FROM attempts WHERE id = ?`, [id]);
      return rows[0] || null;
    },

    async findByExamAndStudent(examId, studentId) {
      const rows = await db.query(
        `SELECT ${ATTEMPT_FIELDS} FROM attempts WHERE exam_id = ? AND student_id = ?`,
        [examId, studentId]
      );
      return rows[0] || null;
    },

    async create(data) {
      const result = await db.query(
        `INSERT INTO attempts
         (exam_id, student_id, started_at, submitted_at, deadline_at, status, objective_score, subjective_score, total_score)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          data.examId,
          data.studentId,
          data.startedAt,
          data.submittedAt ?? null,
          data.deadlineAt,
          data.status || 'in_progress',
          data.objectiveScore ?? 0,
          data.subjectiveScore ?? 0,
          data.totalScore ?? 0
        ]
      );
      return this.findById(result.insertId);
    },

    async update(id, patch) {
      const columns = {
        status: 'status',
        submittedAt: 'submitted_at',
        objectiveScore: 'objective_score',
        subjectiveScore: 'subjective_score',
        totalScore: 'total_score'
      };
      const sets = [];
      const params = [];
      for (const [key, column] of Object.entries(columns)) {
        if (Object.prototype.hasOwnProperty.call(patch, key)) {
          sets.push(`${column} = ?`);
          params.push(patch[key]);
        }
      }
      if (sets.length) {
        await db.query(`UPDATE attempts SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
      }
      return this.findById(id);
    },

    async listByStudent(studentId) {
      return db.query(
        `SELECT ${ATTEMPT_FIELDS} FROM attempts WHERE student_id = ? ORDER BY id ASC`,
        [studentId]
      );
    },

    async listByExamIds(examIds, statuses) {
      if (!Array.isArray(examIds) || examIds.length === 0) return [];
      const params = [...examIds];
      let sql = `SELECT ${ATTEMPT_FIELDS} FROM attempts WHERE exam_id IN (${examIds
        .map(() => '?')
        .join(',')})`;
      if (statuses && statuses.length > 0) {
        sql += ` AND status IN (${statuses.map(() => '?').join(',')})`;
        params.push(...statuses);
      }
      sql += ' ORDER BY id ASC';
      return db.query(sql, params);
    },

    async countByExam(examId) {
      const rows = await db.query('SELECT COUNT(*) AS total FROM attempts WHERE exam_id = ?', [examId]);
      return Number(rows[0].total);
    },

    async countByStudent(studentId) {
      const rows = await db.query('SELECT COUNT(*) AS total FROM attempts WHERE student_id = ?', [studentId]);
      return Number(rows[0].total);
    },

    async countAll() {
      const rows = await db.query('SELECT COUNT(*) AS total FROM attempts');
      return Number(rows[0].total);
    }
  };
}

module.exports = { createAttemptsRepository };
