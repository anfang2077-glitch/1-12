'use strict';

const COURSE_FIELDS = `c.id, c.name, c.code, c.description, c.teacher_id AS teacherId,
  u.real_name AS teacherName, c.created_at AS createdAt`;

/** MySQL 课程仓储 */
function createCoursesRepository(db) {
  return {
    async findById(id) {
      const rows = await db.query(
        `SELECT ${COURSE_FIELDS} FROM courses c LEFT JOIN users u ON u.id = c.teacher_id WHERE c.id = ?`,
        [id]
      );
      return rows[0] || null;
    },

    async findByCode(code) {
      const rows = await db.query('SELECT id, name, code, teacher_id AS teacherId FROM courses WHERE code = ?', [code]);
      return rows[0] || null;
    },

    async listAll() {
      return db.query(`SELECT ${COURSE_FIELDS} FROM courses c LEFT JOIN users u ON u.id = c.teacher_id ORDER BY c.id ASC`);
    },

    async listByTeacherId(teacherId) {
      return db.query(
        `SELECT ${COURSE_FIELDS} FROM courses c LEFT JOIN users u ON u.id = c.teacher_id
         WHERE c.teacher_id = ? ORDER BY c.id ASC`,
        [teacherId]
      );
    },

    async create(data) {
      const result = await db.query(
        'INSERT INTO courses (name, code, description, teacher_id) VALUES (?,?,?,?)',
        [data.name, data.code, data.description ?? null, data.teacherId]
      );
      return this.findById(result.insertId);
    },

    async update(id, patch) {
      const columns = { name: 'name', code: 'code', description: 'description', teacherId: 'teacher_id' };
      const sets = [];
      const params = [];
      for (const [key, column] of Object.entries(columns)) {
        if (Object.prototype.hasOwnProperty.call(patch, key)) {
          sets.push(`${column} = ?`);
          params.push(patch[key]);
        }
      }
      if (sets.length) {
        await db.query(`UPDATE courses SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
      }
      return this.findById(id);
    },

    async remove(id) {
      await db.query('DELETE FROM courses WHERE id = ?', [id]);
    },

    async countByTeacherId(teacherId) {
      const rows = await db.query('SELECT COUNT(*) AS total FROM courses WHERE teacher_id = ?', [teacherId]);
      return Number(rows[0].total);
    }
  };
}

module.exports = { createCoursesRepository };
