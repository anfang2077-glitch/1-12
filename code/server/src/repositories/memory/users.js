'use strict';

function clone(value) {
  return value ? { ...value } : null;
}

/** 内存用户仓储 */
function createUsersRepository(store) {
  const rows = store.tables.users;

  return {
    async findById(id) {
      return clone(rows.find((item) => item.id === id));
    },

    async findByUsername(username) {
      return clone(rows.find((item) => item.username === username));
    },

    async list({ role, keyword, page, pageSize }) {
      let result = rows.slice();
      if (role) result = result.filter((item) => item.role === role);
      if (keyword) {
        const text = String(keyword).toLowerCase();
        result = result.filter(
          (item) =>
            item.username.toLowerCase().includes(text) || item.realName.toLowerCase().includes(text)
        );
      }
      result.sort((a, b) => a.id - b.id);
      const total = result.length;
      const start = (page - 1) * pageSize;
      return { list: result.slice(start, start + pageSize).map(clone), total };
    },

    async create(data) {
      const user = {
        id: store.nextId('users'),
        username: data.username,
        passwordHash: data.passwordHash,
        realName: data.realName,
        role: data.role,
        email: data.email ?? null,
        status: data.status === undefined ? 1 : data.status,
        createdAt: data.createdAt || store.now()
      };
      rows.push(user);
      return clone(user);
    },

    async update(id, patch) {
      const user = rows.find((item) => item.id === id);
      if (!user) return null;
      Object.assign(user, patch);
      return clone(user);
    },

    async remove(id) {
      const index = rows.findIndex((item) => item.id === id);
      if (index >= 0) rows.splice(index, 1);
    },

    async countAll() {
      return rows.length;
    },

    async countByRole(role) {
      return rows.filter((item) => item.role === role).length;
    }
  };
}

module.exports = { createUsersRepository };
