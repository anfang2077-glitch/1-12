import client from './client';

// B16 考试列表（非分页）
export function listExams(params) {
  return client.get('/exams', { params });
}

// B17 组卷并创建考试
export function createExam(payload) {
  return client.post('/exams', payload);
}

// B18 考试详情（含答案与解析，教师/管理员）
export function getExam(id) {
  return client.get(`/exams/${id}`);
}

// B19 修改草稿考试
export function updateExam(id, payload) {
  return client.put(`/exams/${id}`, payload);
}

// B20 删除草稿考试
export function deleteExam(id) {
  return client.delete(`/exams/${id}`);
}

// B21 发布考试
export function publishExam(id) {
  return client.post(`/exams/${id}/publish`);
}

// B22 覆盖式指派考生
export function assignStudents(id, studentIds) {
  return client.post(`/exams/${id}/assign`, { studentIds });
}

// B23 学生可参加考试列表
export function listAvailableExams() {
  return client.get('/exams/available');
}

// B24 学生试卷（无答案）
export function getPaper(examId) {
  return client.get(`/exams/${examId}/paper`);
}

// B25 开考（幂等）
export function startAttempt(examId) {
  return client.post(`/exams/${examId}/attempts`);
}
