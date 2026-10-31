'use strict';

const ANSWER_FIELDS = `id, attempt_id AS attemptId, question_id AS questionId, answer, score,
  comment, graded_by AS gradedBy, graded_at AS gradedAt`;

/** MySQL 答题明细仓储 */
function createAnswersRepository(db) {
  return {
    async findByAttemptAndQuestion(attemptId, questionId) {
      const rows = await db.query(
        `SELECT ${ANSWER_FIELDS} FROM answers WHERE attempt_id = ? AND question_id = ?`,
        [attemptId, questionId]
      );
      return rows[0] || null;
    },

    async listByAttempt(attemptId) {
      return db.query(
        `SELECT ${ANSWER_FIELDS} FROM answers WHERE attempt_id = ? ORDER BY id ASC`,
        [attemptId]
      );
    },

    async upsert(data) {
      await db.query(
        `INSERT INTO answers (attempt_id, question_id, answer, score, comment, graded_by, graded_at)
         VALUES (?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE answer = VALUES(answer)`,
        [
          data.attemptId,
          data.questionId,
          data.answer === undefined || data.answer === null ? null : JSON.stringify(data.answer),
          data.score ?? 0,
          data.comment ?? null,
          data.gradedBy ?? null,
          data.gradedAt ?? null
        ]
      );
      return this.findByAttemptAndQuestion(data.attemptId, data.questionId);
    },

    async ensureRows(attemptId, questionIds) {
      for (const questionId of questionIds) {
        await db.query('INSERT IGNORE INTO answers (attempt_id, question_id) VALUES (?,?)', [
          attemptId,
          questionId
        ]);
      }
    },

    async updateScore(attemptId, questionId, score) {
      await db.query('UPDATE answers SET score = ? WHERE attempt_id = ? AND question_id = ?', [
        score,
        attemptId,
        questionId
      ]);
      return this.findByAttemptAndQuestion(attemptId, questionId);
    },

    async updateGrading(attemptId, questionId, patch) {
      await db.query(
        `INSERT INTO answers (attempt_id, question_id, answer, score, comment, graded_by, graded_at)
         VALUES (?,?, NULL, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE score = VALUES(score), comment = VALUES(comment),
           graded_by = VALUES(graded_by), graded_at = VALUES(graded_at)`,
        [
          attemptId,
          questionId,
          patch.score ?? 0,
          patch.comment ?? null,
          patch.gradedBy ?? null,
          patch.gradedAt ?? null
        ]
      );
      return this.findByAttemptAndQuestion(attemptId, questionId);
    }
  };
}

module.exports = { createAnswersRepository };
