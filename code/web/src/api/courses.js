import client from './client';

// B07 课程列表（按角色过滤）
export function listCourses() {
  return client.get('/courses');
}

// B08 新建课程
export function createCourse(payload) {
  return client.post('/courses', payload);
}

// B09 修改课程
export function updateCourse(id, payload) {
  return client.put(`/courses/${id}`, payload);
}

// B10 删除课程
export function deleteCourse(id) {
  return client.delete(`/courses/${id}`);
}
