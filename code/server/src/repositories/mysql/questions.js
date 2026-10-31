'use strict';

const QUESTION_FIELDS = `id, course_id AS courseId, type, stem, options, answer, score,
  difficulty, knowledge_point AS knowledgePoint, analysis, creator_id AS creatorId,
  created_at AS createdAt`;

/** MySQL 题库仓储 */
function createQuestionsRepository(db) {
  return {
    async findById(id) {
      const rows = await db.query(`SELECT ${QUESTION_FIELDS} FROM questions WHERE id = ?`, [id]);
      return rows[0] || null;
    },

    async list({ courseIds, courseId, type, difficulty, keyword, page, pageSize }) {
      const where = [];
      const params = [];
      if (Array.isArray(courseIds)) {
        if (courseIds.length === 0) return { list: [], total: 0 };
        where.push(`course_id IN (${courseIds.map(() => '?').join(',')})`);
        params.push(...courseIds);
      }
      if (courseId) {
        where.push('course_id = ?');
        params.push(courseId);
      }
      if (type) {
        where.push('type = ?');
        params.push(type);
      }
      if (difficulty) {
        where.push('difficulty = ?');
        params.push(difficulty);
      }
      if (keyword) {
        where.push('stem LIKE ?');
        params.push(`%${keyword}%`);
      }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const countRows = await db.query(`SELECT COUNT(*) AS total FROM questions ${whereSql}`, params);
      const rows = await db.query(
        `SELECT ${QUESTION_FIELDS} FROM questions ${whereSql} ORDER BY id ASC LIMIT ? OFFSET ?`,
        [...params, pageSize, (page - 1) * pageSize]
      );
      return { list: rows, total: Number(countRows[0].total) };
    },

    async create(data) {
      const result = await db.query(
        `INSERT INTO questions
         (course_id, type, stem, options, answer, score, difficulty, knowledge_point, analysis, creator_id)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          data.courseId,
          data.type,
          data.stem,
          data.options ? JSON.stringify(data.options) : null,
          JSON.stringify(data.answer),
          data.score,
          data.difficulty,
          data.knowledgePoint ?? null,
          data.analysis ?? null,
          data.creatorId ?? null
        ]
      );
      return this.findById(result.insertId);
    },

    async update(id, patch) {
      const columns = {
        type: 'type',
        stem: 'stem',
        options: 'options',
        answer: 'answer',
        score: 'score',
        difficulty: 'difficulty',
        knowledgePoint: 'knowledge_point',
        analysis: 'analysis'
      };
      const sets = [];
      const params = [];
      for (const [key, column] of Object.entries(columns)) {
        if (Object.prototype.hasOwnProperty.call(patch, key)) {
          sets.push(`${column} = ?`);
          const value = patch[key];
          params.push(key === 'options' || key === 'answer' ? JSON.stringify(value) : value);
        }
      }
      if (sets.length) {
        await db.query(`UPDATE questions SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
      }
      return this.findById(id);
    },

    async remove(id) {
      await db.query('DELETE FROM questions WHERE id = ?', [id]);
    },

    async countAll() {
      const rows = await db.query('SELECT COUNT(*) AS total FROM questions');
      return Number(rows[0].total);
    },

    async countByCourseId(courseId) {
      const rows = await db.query('SELECT COUNT(*) AS total FROM questions WHERE course_id = ?', [courseId]);
      return Number(rows[0].total);
    }
  };
}

module.exports = { createQuestionsRepository };
