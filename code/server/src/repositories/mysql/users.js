'use strict';

const USER_FIELDS =
  'id, username, password_hash AS passwordHash, real_name AS realName, role, email, status, created_at AS createdAt';

/** MySQL 用户仓储 */
function createUsersRepository(db) {
  return {
    async findById(id) {
      const rows = await db.query(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`, [id]);
      return rows[0] || null;
    },

    async findByUsername(username) {
      const rows = await db.query(`SELECT ${USER_FIELDS} FROM users WHERE username = ?`, [username]);
      return rows[0] || null;
    },

    async list({ role, keyword, page, pageSize }) {
      const where = [];
      const params = [];
      if (role) {
        where.push('role = ?');
        params.push(role);
      }
      if (keyword) {
        where.push('(username LIKE ? OR real_name LIKE ?)');
        params.push(`%${keyword}%`, `%${keyword}%`);
      }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const countRows = await db.query(`SELECT COUNT(*) AS total FROM users ${whereSql}`, params);
      const rows = await db.query(
        `SELECT ${USER_FIELDS} FROM users ${whereSql} ORDER BY id ASC LIMIT ? OFFSET ?`,
        [...params, pageSize, (page - 1) * pageSize]
      );
      return { list: rows, total: Number(countRows[0].total) };
    },

    async create(data) {
      const result = await db.query(
        'INSERT INTO users (username, password_hash, real_name, role, email, status) VALUES (?,?,?,?,?,?)',
        [data.username, data.passwordHash, data.realName, data.role, data.email ?? null, data.status ?? 1]
      );
      return this.findById(result.insertId);
    },

    async update(id, patch) {
      const columns = {
        realName: 'real_name',
        email: 'email',
        status: 'status',
        passwordHash: 'password_hash'
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
        await db.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
      }
      return this.findById(id);
    },

    async remove(id) {
      await db.query('DELETE FROM users WHERE id = ?', [id]);
    },

    async countAll() {
      const rows = await db.query('SELECT COUNT(*) AS total FROM users');
      return Number(rows[0].total);
    },

    async countByRole(role) {
      const rows = await db.query('SELECT COUNT(*) AS total FROM users WHERE role = ?', [role]);
      return Number(rows[0].total);
    }
  };
}

module.exports = { createUsersRepository };
