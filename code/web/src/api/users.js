import client from './client';

// B03 用户分页列表
export function listUsers(params) {
  return client.get('/users', { params });
}

// B04 新建用户
export function createUser(payload) {
  return client.post('/users', payload);
}

// B05 修改用户（含重置密码、禁用/启用）
export function updateUser(id, payload) {
  return client.put(`/users/${id}`, payload);
}

// B06 删除用户
export function deleteUser(id) {
  return client.delete(`/users/${id}`);
}
